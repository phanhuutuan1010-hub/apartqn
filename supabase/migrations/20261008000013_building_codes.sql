-- ApartQN · 13 · per-building listing codes: {PREFIX}-{NNN} (ALT-001 … ALT-999, ALT-1000 …)
-- buildings.code_prefix: 3 letters A–Z, unique, editable only while the building has no coded listing.
-- buildings.code_seq: last number handed out — only ever increases (numbers are never reused, also after hide/delete).
-- listings.legacy_code: the old QN-### code (redirects + search). Reversible: legacy_code keeps the mapping.

alter table public.buildings
  add column code_prefix text check (code_prefix ~ '^[A-Z]{3}$'),
  add column code_seq int not null default 0 check (code_seq >= 0);

update public.buildings set code_prefix = case slug
  when 'altara' then 'ALT' when 'phutai' then 'PTC' when 'flc' then 'FLC' when 'tms' then 'TMS'
  when 'hagl' then 'HAG' when 'apt' then 'APT' when 'thinhphat' then 'TPT' when 'ecolife' then 'ECO'
  else upper(rpad(left(regexp_replace(slug, '[^a-z]', '', 'g'), 3), 3, 'X')) end;
alter table public.buildings alter column code_prefix set not null;
alter table public.buildings add constraint buildings_code_prefix_key unique (code_prefix);

-- prefix default from the slug when omitted; counter is system-owned; prefix frozen once codes exist
create function private.guard_building_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.code_prefix := coalesce(new.code_prefix, upper(rpad(left(regexp_replace(new.slug, '[^a-z]', '', 'g'), 3), 3, 'X')));
    if current_user in ('anon', 'authenticated') then new.code_seq := 0; end if;
    return new;
  end if;
  if current_user in ('anon', 'authenticated') then new.code_seq := old.code_seq; end if;
  if new.code_seq < old.code_seq then new.code_seq := old.code_seq; end if;
  if new.code_prefix is distinct from old.code_prefix and exists (
    select 1 from public.listings l join public.units u on u.id = l.unit_id where u.building_id = new.id and l.code is not null
  ) then
    raise exception 'Toà nhà đã có căn mang mã %-…, không đổi được tiền tố', old.code_prefix using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_code before insert or update on public.buildings for each row execute function private.guard_building_code();

alter table public.listings add column legacy_code text unique check (legacy_code is null or legacy_code ~ '^QN-[0-9]{3,}$');

-- next code for the listing's building: row lock on the building → race-safe, gap-free per building
drop function private.next_listing_code();
create function private.next_listing_code(p_unit uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_prefix text; v_n int;
begin
  update public.buildings b set code_seq = b.code_seq + 1
    from public.units u where u.id = p_unit and b.id = u.building_id
    returning b.code_prefix, b.code_seq into v_prefix, v_n;
  if v_prefix is null then raise exception 'unit % has no building', p_unit; end if;
  return v_prefix || '-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end;
end $$;
revoke all on function private.next_listing_code(uuid) from public;
grant execute on function private.next_listing_code(uuid) to authenticated, service_role;

-- guard_listings: same rules, per-building code
create or replace function private.guard_listings() returns trigger
language plpgsql set search_path = '' as $$
declare
  old_status public.listing_status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
begin
  -- code: system-assigned, immutable
  if tg_op = 'UPDATE' and old.code is not null and new.code is distinct from old.code then
    raise exception 'listing code is permanent (%)', old.code using errcode = '42501';
  end if;
  if new.code is not null and (tg_op = 'INSERT' or old.code is null) and not private.is_trusted() then
    raise exception 'listing code is assigned automatically on first publish' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.unit_id := old.unit_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.legacy_code := old.legacy_code;
  elsif current_user in ('anon', 'authenticated') and not private.is_trusted() then
    new.legacy_code := null;
  end if;

  -- status transitions for non-admin staff (admins, rpc and server may do anything)
  if new.status is distinct from old_status and not (private.is_trusted() or private.is_admin()) then
    if tg_op = 'INSERT' and new.status <> 'draft' then
      raise exception 'new listings start as draft; use submit_listing' using errcode = '42501';
    end if;
    if not (
      (private.is_public_status(old_status) and (private.is_public_status(new.status) or new.status = 'hidden'))
      or (old_status in ('pending', 'hidden') and new.status = 'draft')
      or (old_status = 'hidden' and private.is_public_status(new.status) and private.can_publish())
    ) then
      raise exception 'status change % → % needs approval (use submit_listing)', old_status, new.status using errcode = '42501';
    end if;
  end if;

  -- entering a public state
  if private.is_public_status(new.status) then
    if not private.listing_is_complete(new) then
      raise exception 'listing is missing required fields' using errcode = '23514';
    end if;
    if new.code is null then
      new.code := private.next_listing_code(new.unit_id);
    end if;
    new.published_at := coalesce(new.published_at, now());
    if not private.is_public_status(old_status) then
      new.verified_at := coalesce(new.verified_at, now());
      new.rejection_reason := null;
    end if;
  end if;

  -- translation timestamps
  if tg_op = 'INSERT' or new.desc_vi is distinct from old.desc_vi then
    new.desc_vi_updated_at := case when new.desc_vi is null then null else now() end; end if;
  if tg_op = 'INSERT' or new.desc_en is distinct from old.desc_en then
    new.desc_en_updated_at := case when new.desc_en is null then null else now() end; end if;
  if tg_op = 'INSERT' or new.desc_ru is distinct from old.desc_ru then
    new.desc_ru_updated_at := case when new.desc_ru is null then null else now() end; end if;

  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

-- re-code existing listings: per building, in publish order (old code kept in legacy_code)
alter table public.listings drop constraint listings_code_check;
alter table public.listings disable trigger guard;
alter table public.listings disable trigger stamp;
with ranked as (
  select l.id, l.code, b.id as building_id, b.code_prefix,
         row_number() over (partition by b.id order by l.published_at nulls last, l.code) as n
  from public.listings l join public.units u on u.id = l.unit_id join public.buildings b on b.id = u.building_id
  where l.code is not null and l.code ~ '^QN-'
)
update public.listings l
   set legacy_code = r.code,
       code = r.code_prefix || '-' || case when r.n < 1000 then lpad(r.n::text, 3, '0') else r.n::text end
  from ranked r where r.id = l.id;
alter table public.listings enable trigger stamp;
alter table public.listings enable trigger guard;
update public.buildings b set code_seq = greatest(b.code_seq, coalesce((
  select max(split_part(l.code, '-', 2)::int) from public.listings l join public.units u on u.id = l.unit_id
   where u.building_id = b.id and l.code is not null), 0));
alter table public.listings add constraint listings_code_check check (code ~ '^[A-Z]{3}-[0-9]{3,}$');

-- public views: + code_prefix (search by prefix), + legacy_code (old-URL redirects)
create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  b.aliases, b.code_prefix
from public.buildings b;

create or replace view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, u.floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented');

revoke all on public.public_buildings, public.public_listings from anon, authenticated;
grant select on public.public_buildings, public.public_listings to anon, authenticated, service_role;
