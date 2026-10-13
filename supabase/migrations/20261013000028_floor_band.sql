-- ApartQN · 28 · public floor band instead of the exact floor
-- buildings.total_floors (admin enters it; never guessed). listings.floor_band: the admin's own choice
-- (floor_band_manual = an override that wins over the computed value). The band shown is computed in the views from the
-- unit's floor and the building's total (thirds: low ≤ ceil(n/3), mid ≤ ceil(2n/3), else high), so changing total_floors
-- or the floor needs no recompute. public_listings no longer carries the floor number (the column stays, always NULL,
-- so older readers keep working); the unit number was never there.
alter table public.buildings add column total_floors int check (total_floors between 1 and 150);
alter table public.listings
  add column floor_band text check (floor_band in ('low', 'mid', 'high')),
  add column floor_band_manual boolean not null default false;

create function private.floor_band(p_floor int, p_total int) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_floor is null or p_total is null or p_floor < 1 or p_total < 1 then null
    when p_floor <= ceil(p_total / 3.0) then 'low'
    when p_floor <= ceil(2 * p_total / 3.0) then 'mid'
    else 'high' end
$$;
grant execute on function private.floor_band(int, int) to anon, authenticated, service_role;

create or replace view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, null::int as floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by,
  case when l.floor_band_manual then l.floor_band else coalesce(private.floor_band(u.floor, b.total_floors), l.floor_band) end as floor_band
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented')
  and l.deleted_at is null and b.deleted_at is null and b.is_visible;


create or replace view public.admin_listings with (security_invoker = true) as
select
  l.id, l.code, l.status, l.rent, l.beds, l.area, l.furn, l.move_in, l.verified, l.verified_at,
  l.desc_vi is not null as has_vi, l.desc_en is not null as has_en, l.desc_ru is not null as has_ru,
  (l.desc_en is not null and l.desc_vi_updated_at > l.desc_en_updated_at) as en_outdated,
  (l.desc_ru is not null and l.desc_vi_updated_at > l.desc_ru_updated_at) as ru_outdated,
  l.rejection_reason, l.submitted_at, l.published_at, l.is_demo, l.updated_at, l.updated_by, l.created_at,
  u.id as unit_id, u.floor, u.unit_no, u.assigned_to,
  b.id as building_id, b.slug as building_slug, b.name as building_name,
  (select count(*) from public.photos p where p.listing_id = l.id)::int as photo_count,
  private.en_status(l.desc_vi, l.desc_en, l.desc_en_vi_hash) as en_status,
  case when l.floor_band_manual then l.floor_band else coalesce(private.floor_band(u.floor, b.total_floors), l.floor_band) end as floor_band,
  l.floor_band_manual, b.total_floors
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.deleted_at is null and b.deleted_at is null;
