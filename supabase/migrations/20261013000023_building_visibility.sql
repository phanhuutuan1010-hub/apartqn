-- ApartQN · 23 · show / hide a building on the website
-- buildings.is_visible (admin switch). A hidden building and its listings drop out of the public views only —
-- listing rows are never touched, so showing the building again restores everything as it was.
alter table public.buildings add column is_visible boolean not null default true;

create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  b.aliases, b.code_prefix,
  b.mgmt_fee_per_m2, b.mgmt_fee_vat_pct, b.motorbike_fee, b.motorbike_fee_from_3rd, b.car_fee, b.car_parking, b.bicycle_fee,
  b.electricity_rate, b.electricity_vat_pct, b.water_rate, b.water_vat_pct, b.water_extra_note, b.fee_updated_on, b.fee_verified,
  b.maps_url, b.video_url
from public.buildings b
where b.deleted_at is null and b.is_visible;

create or replace view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, u.floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented')
  and l.deleted_at is null and b.deleted_at is null and b.is_visible;

-- The public page of a hidden building redirects instead of 404: the site may ask "is this slug hidden?" and nothing else.
create function public.building_hidden(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.buildings b where b.slug = p_slug and b.deleted_at is null and not b.is_visible)
$$;
revoke all on function public.building_hidden(text) from public;
grant execute on function public.building_hidden(text) to anon, authenticated, service_role;
