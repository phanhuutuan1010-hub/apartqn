-- ApartQN · 17 · gallery: photo tags + source, building video
-- photos.tag: what the photo shows (lightbox tabs). photos.source: own shot or reference image (badge on the site).
-- A reference photo is never watermarked (it is not ours to brand). Additive only.
alter table public.photos
  add column if not exists tag text not null default 'khac'
    check (tag in ('toan-canh', 'tien-ich', 'sanh', 'view', 'can-ho', 'khac')),
  add column if not exists source text not null default 'own'
    check (source in ('own', 'reference'));
update public.photos set watermark = false where source = 'reference' and watermark;
alter table public.photos add constraint photos_reference_no_watermark check (not (source = 'reference' and watermark));

create or replace function private.photos_watermark_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.watermark is null then new.watermark := new.listing_id is not null and new.source <> 'reference'; end if;
  return new;
end $$;

alter table public.buildings
  add column if not exists video_url text
    check (video_url is null or video_url ~ '^https://(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}');

-- public views: photos carry tag + source; buildings + video_url
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
from public.buildings b;

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
where l.code is not null and l.status in ('available', 'reserved', 'rented');
