-- ApartQN · 24 · photo grid bulk actions: soft delete (Thùng rác), move between a building and its listings
-- photos.deleted_at / deleted_by. Trashed photos are invisible to staff (RLS) and to the public views; they come back with
-- restore_photos() or leave for good with purge_photos() (admin, or the daily cron after 30 days), which returns the storage
-- objects to remove. Each bulk action is one rpc: all-or-nothing, permissions checked per photo inside.
alter table public.photos
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;
create index photos_deleted_idx on public.photos (deleted_at) where deleted_at is not null;

alter policy photos_admin_all on public.photos
  using ((select private.is_admin()) and deleted_at is null) with check ((select private.is_admin()) and deleted_at is null);
alter policy photos_sales_read on public.photos
  using (deleted_at is null and (
         (listing_id is not null and private.owns_listing(listing_id))
      or (unit_id is not null and private.owns_unit(unit_id))
      or (building_id is not null and visibility = 'public'::public.photo_visibility and (select private.is_staff()))));
alter policy photos_sales_insert on public.photos
  with check (deleted_at is null and ((listing_id is not null and private.owns_listing(listing_id))
           or (unit_id is not null and private.owns_unit(unit_id))));
alter policy photos_sales_update on public.photos
  using (deleted_at is null and ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id))))
  with check (deleted_at is null and ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id))));
alter policy photos_sales_delete on public.photos
  using (deleted_at is null and ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id))));

-- the owner of a photo changes only inside move_photos()
create or replace function private.guard_photos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.rpc', true), '') <> 'on' then
      new.listing_id := old.listing_id; new.building_id := old.building_id; new.unit_id := old.unit_id;
    end if;
    new.created_by := old.created_by;
  end if;
  return new;
end $$;

-- ───────────── public views: no trashed photos ─────────────
create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source)
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
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented')
  and l.deleted_at is null and b.deleted_at is null and b.is_visible;

-- ───────────── helpers ─────────────
-- May the caller change this photo? Admin (or the server): any. Sales: photos of their own listings. Building photos: admin only.
create function private.can_edit_photo(p public.photos) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or private.is_trusted() or (p.listing_id is not null and private.owns_listing(p.listing_id))
$$;

-- One public, live photo of the owner becomes the cover when the owner has none.
create function private.ensure_cover(p_listing uuid, p_building uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_listing is null and p_building is null then return; end if;
  if exists (select 1 from public.photos where deleted_at is null and is_cover
              and ((p_listing is not null and listing_id = p_listing) or (p_building is not null and building_id = p_building))) then return; end if;
  update public.photos set is_cover = true where id = (
    select id from public.photos where deleted_at is null and visibility = 'public'
       and ((p_listing is not null and listing_id = p_listing) or (p_building is not null and building_id = p_building))
     order by sort, created_at limit 1);
end $$;

-- p_batch: the first id stands for everything trashed together with it (same owner, same moment) — the Thùng rác row.
create function private.photo_batch(p_ids uuid[], p_batch boolean) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case when not p_batch then p_ids else coalesce((
    select array_agg(x.id) from public.photos p join public.photos x
        on x.deleted_at = p.deleted_at and x.listing_id is not distinct from p.listing_id
       and x.building_id is not distinct from p.building_id and x.unit_id is not distinct from p.unit_id
     where p.id = p_ids[1] and p.deleted_at is not null), '{}') end
$$;

-- ───────────── rpc: trash / restore / purge ─────────────
create function public.trash_photos(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; r record;
begin
  if cardinality(p_ids) > 200 then raise exception 'too many photos' using errcode = '22023'; end if;
  if exists (select 1 from public.photos p where p.id = any (p_ids) and p.deleted_at is null and not private.can_edit_photo(p)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.photos set deleted_at = now(), deleted_by = auth.uid(), is_cover = false where id = any (p_ids) and deleted_at is null;
  get diagnostics n = row_count;
  -- a trashed cover hands over to the next photo
  for r in select distinct listing_id, building_id from public.photos where id = any (p_ids) loop
    perform private.ensure_cover(r.listing_id, r.building_id);
  end loop;
  return n;
end $$;

create function public.restore_photos(p_ids uuid[], p_batch boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare ids uuid[] := private.photo_batch(p_ids, p_batch); n int; r record;
begin
  if exists (select 1 from public.photos p where p.id = any (ids) and p.deleted_at is not null and not private.can_edit_photo(p)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.photos set deleted_at = null, deleted_by = null where id = any (ids) and deleted_at is not null;
  get diagnostics n = row_count;
  for r in select distinct listing_id, building_id from public.photos where id = any (ids) loop
    perform private.ensure_cover(r.listing_id, r.building_id);
  end loop;
  return n;
end $$;

-- Hard delete trashed photos: the given ones (admin, from Thùng rác) or everything trashed before p_before (cron).
create function public.purge_photos(p_ids uuid[] default null, p_batch boolean default false, p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; files jsonb;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_ids is not null then ids := private.photo_batch(p_ids, p_batch);
  elsif p_before is not null then select coalesce(array_agg(id), '{}') into ids from public.photos where deleted_at < p_before;
  else raise exception 'nothing to purge' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(o), '[]'::jsonb) into files from (
    select jsonb_build_object('bucket', p.bucket, 'path', p.path) as o from public.photos p where p.id = any (ids) and p.deleted_at is not null
    union all select jsonb_build_object('bucket', p.bucket, 'path', p.thumb_path) from public.photos p where p.id = any (ids) and p.deleted_at is not null and p.thumb_path is not null
    union all select jsonb_build_object('bucket', 'listing-master', 'path', p.master_path) from public.photos p where p.id = any (ids) and p.deleted_at is not null and p.master_path is not null
  ) s;
  delete from public.photos where id = any (ids) and deleted_at is not null;
  return files;
end $$;

-- ───────────── rpc: move between a building and its listings ─────────────
-- p_kind 'listing' | 'building'. The target must be the same building (or a listing in it). Only the row changes owner:
-- files stay where they are. Photos land at the end, never as extra covers. Returns the moved public photos that now need
-- a watermark (listing photos are watermarked by default; reference photos never) — the app re-renders those.
create function public.move_photos(p_ids uuid[], p_kind text, p_target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t_building uuid; ids uuid[]; src_l uuid[]; src_b uuid[]; bad boolean; other boolean; internal boolean;
  n int; base int; need jsonb; x uuid;
begin
  if cardinality(p_ids) > 200 then raise exception 'too many photos' using errcode = '22023'; end if;
  if p_kind = 'listing' then
    select u.building_id into t_building from public.listings l join public.units u on u.id = l.unit_id
     where l.id = p_target and l.deleted_at is null;
    if not found then raise exception 'target not found' using errcode = '22023'; end if;
    if not (private.is_admin() or private.owns_listing(p_target)) then raise exception 'not allowed' using errcode = '42501'; end if;
  elsif p_kind = 'building' then
    if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
    select b.id into t_building from public.buildings b where b.id = p_target and b.deleted_at is null;
    if not found then raise exception 'target not found' using errcode = '22023'; end if;
  else raise exception 'bad target' using errcode = '22023';
  end if;

  select coalesce(array_agg(p.id order by p.sort, p.created_at), '{}'),
         coalesce(array_agg(distinct p.listing_id) filter (where p.listing_id is not null), '{}'),
         coalesce(array_agg(distinct p.building_id) filter (where p.building_id is not null), '{}'),
         coalesce(bool_or(not private.can_edit_photo(p)), false),
         coalesce(bool_or(coalesce(p.building_id, (select u.building_id from public.listings l join public.units u on u.id = l.unit_id where l.id = p.listing_id))
                          is distinct from t_building), false),
         coalesce(bool_or(p.visibility <> 'public'), false)
    into ids, src_l, src_b, bad, other, internal
    from public.photos p
   where p.id = any (p_ids) and p.deleted_at is null and p.unit_id is null
     and not ((p_kind = 'listing' and p.listing_id is not distinct from p_target) or (p_kind = 'building' and p.building_id is not distinct from p_target));
  if bad then raise exception 'not allowed' using errcode = '42501'; end if;
  if other then raise exception 'other building' using errcode = '22023'; end if;
  if p_kind = 'building' and internal then raise exception 'internal photo' using errcode = '22023'; end if;

  select coalesce(max(p.sort), -1) + 1 into base from public.photos p
   where p.deleted_at is null and ((p_kind = 'listing' and p.listing_id = p_target) or (p_kind = 'building' and p.building_id = p_target));
  perform set_config('app.rpc', 'on', true);
  update public.photos p set
    listing_id = case when p_kind = 'listing' then p_target end,
    building_id = case when p_kind = 'building' then p_target end,
    is_cover = false, sort = base + array_position(ids, p.id) - 1
  where p.id = any (ids);
  get diagnostics n = row_count;
  perform set_config('app.rpc', 'off', true);

  foreach x in array src_l loop perform private.ensure_cover(x, null); end loop;
  foreach x in array src_b loop perform private.ensure_cover(null, x); end loop;
  perform private.ensure_cover(case when p_kind = 'listing' then p_target end, case when p_kind = 'building' then p_target end);

  select coalesce(jsonb_agg(p.id), '[]'::jsonb) into need from public.photos p
   where p.id = any (ids) and p_kind = 'listing' and p.visibility = 'public' and not p.watermark and p.source is distinct from 'reference';
  return jsonb_build_object('moved', n, 'need_watermark', need);
end $$;

revoke all on function public.trash_photos(uuid[]), public.restore_photos(uuid[], boolean),
  public.purge_photos(uuid[], boolean, timestamptz), public.move_photos(uuid[], text, uuid) from public, anon;
grant execute on function public.trash_photos(uuid[]), public.restore_photos(uuid[], boolean),
  public.purge_photos(uuid[], boolean, timestamptz), public.move_photos(uuid[], text, uuid) to authenticated, service_role;

-- ───────────── Thùng rác: photos, one row per batch ─────────────
create or replace function public.trash_items()
returns table (kind text, id uuid, label text, detail text, deleted_at timestamptz, deleted_by uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select 'listing', l.id, coalesce(l.code, 'Nháp') || ' · ' || b.name, 'Tầng ' || u.floor || ' · căn ' || u.unit_no
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
