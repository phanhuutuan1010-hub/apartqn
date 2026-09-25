-- ApartQN · 6 · admin helpers
-- admin_listings: one row per listing with its unit + building, for the admin table.
-- security_invoker = true → the CALLER's RLS applies (sales see only their own units/listings).

create view public.admin_listings with (security_invoker = true) as
select
  l.id, l.code, l.status, l.rent, l.beds, l.area, l.furn, l.move_in, l.verified, l.verified_at,
  l.desc_vi is not null as has_vi, l.desc_en is not null as has_en, l.desc_ru is not null as has_ru,
  (l.desc_en is not null and l.desc_vi_updated_at > l.desc_en_updated_at) as en_outdated,
  (l.desc_ru is not null and l.desc_vi_updated_at > l.desc_ru_updated_at) as ru_outdated,
  l.rejection_reason, l.submitted_at, l.published_at, l.is_demo, l.updated_at, l.updated_by, l.created_at,
  u.id as unit_id, u.floor, u.unit_no, u.assigned_to,
  b.id as building_id, b.slug as building_slug, b.name as building_name,
  (select count(*) from public.photos p where p.listing_id = l.id)::int as photo_count
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id;

revoke all on public.admin_listings from anon, authenticated;
grant select on public.admin_listings to authenticated, service_role;

-- Create unit + draft listing atomically (SECURITY INVOKER: normal RLS + guard triggers apply,
-- so sales get the unit assigned to themselves). Returns the new listing id.
create function public.create_listing_draft(p_building uuid, p_floor int, p_unit_no text, p_assigned_to uuid default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_unit uuid; v_listing uuid;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.units (building_id, floor, unit_no, assigned_to)
  values (p_building, p_floor, trim(p_unit_no), coalesce(p_assigned_to, auth.uid()))
  returning id into v_unit;
  insert into public.listings (unit_id) values (v_unit) returning id into v_listing;
  return v_listing;
exception when unique_violation then
  raise exception 'Căn này đã có trong hệ thống (toà nhà + tầng + số căn trùng)' using errcode = '23505';
end $$;

revoke all on function public.create_listing_draft(uuid, int, text, uuid) from public, anon;
grant execute on function public.create_listing_draft(uuid, int, text, uuid) to authenticated, service_role;
