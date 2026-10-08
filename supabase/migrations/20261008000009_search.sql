-- ApartQN · 9 · smart search
-- buildings.aliases: other names people type ("Altara", "Алтара", "FLC Sea"), any script; used by the search index only.
-- public views: + aliases, + verified_at / published_at (ranking of search suggestions). New columns go last
-- (create or replace view can only append).

alter table public.buildings
  add column aliases text[] not null default '{}'
    check (cardinality(aliases) <= 20 and length(array_to_string(aliases, '')) <= 1200);

create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  b.aliases
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
  l.verified_at, l.published_at
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented');

-- grants survive create or replace; repeated for clarity
revoke all on public.public_buildings, public.public_listings from anon, authenticated;
grant select on public.public_buildings, public.public_listings to anon, authenticated, service_role;
