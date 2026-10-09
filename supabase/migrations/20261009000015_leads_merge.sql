-- ApartQN · 15 · one inbox: consign requests become leads (type 'consign'); site hotline; drop the old QN sequence
--
-- leads.type: 'rent' (viewing / manual) · 'search' ("Nhờ tìm giúp") · 'consign' (owner offers an apartment).
-- Consign leads keep the request in payload (building, floor, area, beds, asking rent, unit/listing created on
-- assignment, rejection reason) and the owner's photos in photo_paths (private consign-inbox bucket).
-- Visibility is unchanged: a consign lead is unassigned (assigned_to null → admins only) until an admin assigns it.
-- consign_inbox is kept (read-only archive, rows copied with the same ids); a trigger mirrors any late insert from
-- an old deployment into leads, so nothing is lost while the new code rolls out.

alter table public.leads
  add column type text not null default 'rent' check (type in ('rent', 'search', 'consign')),
  add column payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 4000),
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 10);
update public.leads set type = 'search' where search is not null;
create index leads_type_idx on public.leads (type, status, created_at desc);

-- consign_inbox row → lead (same id). new → new (unassigned), assigned → new (assignee works it), rejected → lost
create function private.consign_to_lead(c public.consign_inbox) returns void
language sql security definer set search_path = '' as $$
  insert into public.leads (id, type, name, phone, channel, locale, page, status, assigned_to, listing_id, photo_paths, payload,
                            created_at, updated_at, updated_by)
  values (c.id, 'consign', c.owner_name, c.owner_phone, 'web', c.locale, c.page,
          case c.status when 'rejected' then 'lost'::public.lead_status else 'new'::public.lead_status end,
          case when c.status = 'assigned' then c.assigned_to end,
          c.listing_id, c.photo_paths,
          jsonb_strip_nulls(jsonb_build_object(
            'building_id', c.building_id, 'building_text', c.building_text, 'floor', c.floor, 'area', c.area,
            'beds', c.beds, 'rent', c.rent, 'unit_id', c.unit_id, 'assigned_at', c.assigned_at,
            'rejection_reason', c.rejection_reason)),
          c.created_at, c.updated_at, c.updated_by)
  on conflict (id) do nothing
$$;
revoke all on function private.consign_to_lead(public.consign_inbox) from public, anon, authenticated;

alter table public.leads disable trigger stamp;
alter table public.leads disable trigger guard;
select private.consign_to_lead(c) from public.consign_inbox c;
alter table public.leads enable trigger stamp;
alter table public.leads enable trigger guard;

create function private.mirror_consign() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.consign_to_lead(new);
  return new;
end $$;
create trigger mirror_to_leads after insert on public.consign_inbox for each row execute function private.mirror_consign();

-- the archive is no longer edited by staff
revoke insert, update, delete on public.consign_inbox from authenticated;

-- staff may not rewrite a lead's origin (type, owner photos, consign request); admins and the server may
create or replace function private.guard_leads() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.assigned_to := auth.uid();
    if new.type = 'consign' or cardinality(new.photo_paths) > 0 then
      raise exception 'only the website creates consign leads' using errcode = '42501';
    end if;
  else
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'only admins can reassign' using errcode = '42501';
    end if;
    if new.type is distinct from old.type or new.payload is distinct from old.payload
       or new.photo_paths is distinct from old.photo_paths or new.listing_id is distinct from old.listing_id then
      raise exception 'only admins can change the request' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Admin: assign a consign lead → unit (owner data) + draft listing prefilled from the request. Returns the listing id.
create function public.assign_consign_lead(p_lead uuid, p_assignee uuid, p_building uuid, p_floor int, p_unit_no text)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c public.leads; v_unit uuid; v_listing uuid; v_rent bigint; v_area numeric; v_beds int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into c from public.leads where id = p_lead and type = 'consign' for update;
  if not found then raise exception 'consign request not found' using errcode = 'P0002'; end if;
  if c.listing_id is not null or c.status <> 'new' or c.assigned_to is not null then
    raise exception 'consign request is already handled' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee and active) then
    raise exception 'assignee is not an active staff member' using errcode = '22023';
  end if;

  insert into public.units (building_id, floor, unit_no, owner_name, owner_phone, owner_notes, assigned_to)
  values (p_building, p_floor, trim(p_unit_no), c.name, c.phone,
          'Từ form ký gửi ngày ' || to_char(c.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'), p_assignee)
  returning id into v_unit;

  v_rent := private.digits_to_bigint(c.payload ->> 'rent');
  v_area := private.to_numeric(c.payload ->> 'area');
  v_beds := private.to_numeric(c.payload ->> 'beds')::int;
  insert into public.listings (unit_id, rent, area, beds)
  values (v_unit,
          case when v_rent between 1000000 and 1000000000 then v_rent end,
          case when v_area > 0 and v_area < 1000 then v_area end,
          case when v_beds between 0 and 10 then v_beds end)
  returning id into v_listing;

  update public.leads
     set assigned_to = p_assignee, listing_id = v_listing,
         payload = payload || jsonb_build_object('building_id', p_building, 'unit_id', v_unit, 'assigned_at', now())
   where id = p_lead;
  return v_listing;
exception when unique_violation then
  raise exception 'Căn này đã có trong hệ thống (toà nhà + tầng + số căn trùng)' using errcode = '23505';
end $$;
revoke all on function public.assign_consign_lead(uuid, uuid, uuid, int, text) from public, anon;
grant execute on function public.assign_consign_lead(uuid, uuid, uuid, int, text) to authenticated, service_role;

-- owner photos of a consign lead: admins, or the assignee
create or replace function private.can_read_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.is_admin() then true
    when p_bucket = 'consign-inbox' then exists (
      select 1 from public.leads l
       where l.type = 'consign' and l.assigned_to = auth.uid() and p_name = any (l.photo_paths))
      and private.is_staff()
    else private.can_write_object(p_bucket, p_name)
  end
$$;

-- handover: consign leads move with the other leads (counted separately for the report)
create or replace function public.reassign_all(p_from uuid, p_to uuid)
returns table (units int, leads int, consign int)
language plpgsql security definer set search_path = '' as $$
declare n_units int; n_leads int; n_consign int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'same user' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_to and active) then
    raise exception 'target user is not an active staff member' using errcode = '22023';
  end if;
  update public.units set assigned_to = p_to where assigned_to = p_from;
  get diagnostics n_units = row_count;
  select count(*) into n_consign from public.leads
   where assigned_to = p_from and status not in ('won', 'lost') and type = 'consign';
  update public.leads set assigned_to = p_to where assigned_to = p_from and status not in ('won', 'lost');
  get diagnostics n_leads = row_count;
  return query select n_units, n_leads - n_consign, n_consign;
end $$;

-- site hotline for "Tạo bài đăng" (null → the site's default number)
alter table public.settings add column hotline text check (hotline is null or hotline ~ '^[0-9+() .-]{6,24}$');

-- the global QN-### counter is unused since per-building codes (migration 13); legacy_code + 301s stay
drop sequence public.listing_code_seq;
