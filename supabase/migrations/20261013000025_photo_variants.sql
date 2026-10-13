-- ApartQN · 25 · sharp photos: one encode from the original, own responsive variants
-- photos.variants: the public files of a photo, [{w, h, path}] smallest first (640 / 1200 / 1920 px wide, never upscaled).
--   path = the largest variant, thumb_path = the smallest (older readers keep working). null = rendered before this migration.
-- listing-master now also receives the untouched upload (≤ 25 MB, deleted once the master exists); masters are ≤ 2400 px.
-- Public views expose the variants ('v'); purge returns every variant file. Additive only.
alter table public.photos add column variants jsonb check (variants is null or jsonb_typeof(variants) = 'array');

update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
where id = 'listing-master';

create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
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
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented')
  and l.deleted_at is null and b.deleted_at is null and b.is_visible;

-- every storage object of a set of photos: public / internal files, all variants, the master
create function private.photo_files(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct o), '[]'::jsonb) from (
    select jsonb_build_object('bucket', p.bucket, 'path', p.path) as o from public.photos p where p.id = any (p_ids)
    union all select jsonb_build_object('bucket', p.bucket, 'path', p.thumb_path) from public.photos p where p.id = any (p_ids) and p.thumb_path is not null
    union all select jsonb_build_object('bucket', p.bucket, 'path', v->>'path') from public.photos p, jsonb_array_elements(coalesce(p.variants, '[]'::jsonb)) v where p.id = any (p_ids)
    union all select jsonb_build_object('bucket', 'listing-master', 'path', p.master_path) from public.photos p where p.id = any (p_ids) and p.master_path is not null
  ) s
$$;

create or replace function private.photo_objects(p_where text, p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare ids uuid[];
begin
  execute format('select coalesce(array_agg(p.id), ''{}'') from public.photos p where p.%1$I = $1', p_where) into ids using p_id;
  return private.photo_files(ids);
end $$;

create or replace function public.purge_photos(p_ids uuid[] default null, p_batch boolean default false, p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; files jsonb;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_ids is not null then ids := private.photo_batch(p_ids, p_batch);
  elsif p_before is not null then select coalesce(array_agg(id), '{}') into ids from public.photos where deleted_at < p_before;
  else raise exception 'nothing to purge' using errcode = '22023';
  end if;
  select coalesce(array_agg(id), '{}') into ids from public.photos where id = any (ids) and deleted_at is not null;
  files := private.photo_files(ids);
  delete from public.photos where id = any (ids);
  return files;
end $$;
