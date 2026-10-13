-- ApartQN · 27 · unit number optional (internal), move-in date defaults to today
-- units.unit_no may be NULL: nothing generates it, an empty input stays empty. The duplicate rule (building + floor +
-- unit_key) only applies when it is filled — NULLs never collide in the unique index. Existing rows are not touched.
-- listings.move_in: new listings start with today (Vietnam time); listings without a date get their creation date.
alter table public.units alter column unit_no drop not null;

create or replace function public.create_listing_draft(p_building uuid, p_floor int, p_unit_no text, p_assigned_to uuid default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_unit uuid; v_listing uuid;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.units (building_id, floor, unit_no, assigned_to)
  values (p_building, p_floor, nullif(trim(p_unit_no), ''), coalesce(p_assigned_to, auth.uid()))
  returning id into v_unit;
  insert into public.listings (unit_id) values (v_unit) returning id into v_listing;
  return v_listing;
exception when unique_violation then
  raise exception 'Căn này đã có trong hệ thống (toà nhà + tầng + số căn trùng)' using errcode = '23505';
end $$;

create or replace function public.assign_consign_lead(p_lead uuid, p_assignee uuid, p_building uuid, p_floor int, p_unit_no text)
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
  values (p_building, p_floor, nullif(trim(p_unit_no), ''), c.name, c.phone,
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

-- Thùng rác: a listing without a unit number still gets its detail line
create or replace function public.trash_items()
returns table (kind text, id uuid, label text, detail text, deleted_at timestamptz, deleted_by uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select 'listing', l.id, coalesce(l.code, 'Nháp') || ' · ' || b.name, 'Tầng ' || u.floor || coalesce(' · căn ' || u.unit_no, '')
                      || case when b.deleted_at is not null then ' · toà nhà cũng đã xoá' else '' end, l.deleted_at, l.deleted_by
      from public.listings l join public.units u on u.id = l.unit_id join public.buildings b on b.id = u.building_id
     where l.deleted_at is not null
    union all
    select 'building', b.id, b.name, b.code_prefix || ' · /' || b.slug, b.deleted_at, b.deleted_by
      from public.buildings b where b.deleted_at is not null
    union all
    select 'lead', d.id, d.name, d.phone || ' · ' || d.type || coalesce(' · ' || x.code, ''), d.deleted_at, d.deleted_by
      from public.leads d left join public.listings x on x.id = d.listing_id where d.deleted_at is not null
    union all
    select 'photo', (array_agg(p.id order by p.sort, p.id))[1], count(*) || ' ảnh',
           coalesce(max('Căn ' || coalesce(l.code, 'nháp') || ' · ' || lb.name), max('Toà nhà ' || pb.name), 'Ảnh căn'),
           p.deleted_at, (array_agg(p.deleted_by))[1]
      from public.photos p
      left join public.listings l on l.id = p.listing_id
      left join public.units u on u.id = l.unit_id
      left join public.buildings lb on lb.id = u.building_id
      left join public.buildings pb on pb.id = p.building_id
     where p.deleted_at is not null
     group by p.deleted_at, p.listing_id, p.building_id, p.unit_id
    order by 5 desc;
end $$;


alter table public.listings alter column move_in set default ((now() at time zone 'Asia/Ho_Chi_Minh')::date);
-- backfill without touching "Cập nhật" (updated_at)
alter table public.listings disable trigger stamp;
update public.listings set move_in = (created_at at time zone 'Asia/Ho_Chi_Minh')::date where move_in is null;
alter table public.listings enable trigger stamp;
