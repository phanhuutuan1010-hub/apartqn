-- ApartQN · 12 · photo watermark + YouTube video
-- listing-master: PRIVATE bucket with the clean (un-watermarked) master of every public photo. Same staff rules as
--   listing-internal (admins: everything; sales: their own listings/<id>/ folder). listing-public is unchanged.
-- photos: master_path (in listing-master), watermark (listing photos on, building photos off by default),
--   wm_version (lib/watermark.ts version the public files were rendered with; null = original upload, not re-rendered).
-- listings.video_url: an (unlisted) YouTube link; video files are never uploaded. `video` follows it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-master', 'listing-master', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_write_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.is_admin() then p_bucket in ('listing-public', 'listing-internal', 'listing-master')
    when p_bucket in ('listing-public', 'listing-internal', 'listing-master') and split_part(p_name, '/', 1) = 'listings'
      then private.owns_listing(private.try_uuid(split_part(p_name, '/', 2)))
    when p_bucket = 'listing-internal' and split_part(p_name, '/', 1) = 'units'
      then private.owns_unit(private.try_uuid(split_part(p_name, '/', 2)))
    else false
  end
$$;

alter policy aqn_staff_read on storage.objects
  using (bucket_id in ('listing-public', 'listing-internal', 'listing-master', 'consign-inbox') and private.can_read_object(bucket_id, name));
alter policy aqn_staff_insert on storage.objects
  with check (bucket_id in ('listing-public', 'listing-internal', 'listing-master') and private.can_write_object(bucket_id, name));
alter policy aqn_staff_update on storage.objects
  using (bucket_id in ('listing-public', 'listing-internal', 'listing-master') and private.can_write_object(bucket_id, name))
  with check (bucket_id in ('listing-public', 'listing-internal', 'listing-master') and private.can_write_object(bucket_id, name));
alter policy aqn_staff_delete on storage.objects
  using (bucket_id in ('listing-public', 'listing-internal', 'listing-master', 'consign-inbox')
         and (private.is_admin() or private.can_write_object(bucket_id, name)));

alter table public.photos
  add column master_path text check (master_path is null or length(master_path) <= 300),
  add column watermark boolean,
  add column wm_version int check (wm_version is null or wm_version > 0);
update public.photos set watermark = (listing_id is not null) where watermark is null;
alter table public.photos alter column watermark set not null;

-- default per owner: listing photos watermarked, building photos not (often third-party images)
create function private.photos_watermark_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.watermark is null then new.watermark := new.listing_id is not null; end if;
  return new;
end $$;
create trigger watermark_default before insert on public.photos for each row execute function private.photos_watermark_default();

alter table public.listings
  add column video_url text check (video_url is null or video_url ~ '^https://(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}');

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
  l.verified_at, l.published_at, l.video_url
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented');

revoke all on public.public_buildings, public.public_listings from anon, authenticated;
grant select on public.public_buildings, public.public_listings to anon, authenticated, service_role;
