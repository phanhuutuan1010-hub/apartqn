-- ApartQN · 41 · pivot: buildings + unit types (sample units). Public listings retired.
--
-- unit_types: one row per building × type (studio / 1pn / 2pn / 3pn), code {PREFIX}-{STUDIO|1PN|2PN|3PN}. Reference
--   values only ("from" price, area range, notes, features, descriptions) — never availability, floor or unit number.
--   Hidden empty drafts are created for every building (and for every new building); values are never invented.
-- photos.unit_type_id: sample-unit photos (public, watermarked by default — same pipeline as listing photos).
-- leads.unit_type_id: "Kiểm tra căn trống" requests.
-- ARCHIVE (nothing dropped, nothing deleted): listings + units get is_archived / archived_at; public_listings is revoked
--   from the site, staff lose every write (and sales every read) on listings / units / their photos; admins keep read.
--   The trash cron no longer purges archived rows. post_clicks (listing short links): admins read only, no new rows.

-- ───────────────────────── archive ─────────────────────────
alter table public.listings add column is_archived boolean not null default false, add column archived_at timestamptz;
alter table public.units add column is_archived boolean not null default false, add column archived_at timestamptz;
-- no trigger: updated_at, codes and status stay exactly as they were
alter table public.listings disable trigger user;
update public.listings set is_archived = true, archived_at = now() where not is_archived;
alter table public.listings enable trigger user;
alter table public.units disable trigger user;
update public.units set is_archived = true, archived_at = now() where not is_archived;
alter table public.units enable trigger user;

drop policy listings_admin_all on public.listings;
drop policy listings_sales_read on public.listings;
drop policy listings_sales_insert on public.listings;
drop policy listings_sales_update on public.listings;
create policy listings_admin_read on public.listings for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.listings from authenticated;

drop policy units_admin_all on public.units;
drop policy units_sales_read on public.units;
drop policy units_sales_insert on public.units;
drop policy units_sales_update on public.units;
create policy units_admin_read on public.units for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.units from authenticated;

-- the site no longer reads listings: the view is emptied and closed to the publishable key
create or replace view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, null::int as floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  '[]'::jsonb as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by,
  null::text as floor_band
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where not l.is_archived and l.code is not null and l.status in ('available', 'reserved', 'rented')
  and l.deleted_at is null and b.deleted_at is null and b.is_visible;
revoke all on public.public_listings from anon, authenticated;

-- every listing rpc: server only (nothing in the app calls them any more)
revoke execute on function public.submit_listing(uuid), public.approve_listing(uuid), public.reject_listing(uuid, text),
  public.check_duplicate(uuid, int, text), public.create_listing_draft(uuid, int, text, uuid),
  public.assign_consign(uuid, uuid, uuid, int, text), public.assign_consign_lead(uuid, uuid, uuid, int, text),
  public.trash_listing(uuid), public.restore_listing(uuid), public.trash_listings(uuid[]), public.restore_listings(uuid[]),
  public.purge_listing(uuid), public.peek_next_listing_code(uuid), public.set_marketplace(uuid, text, text),
  public.set_marketplace_lang(uuid, text), public.marketplace_reminders(), public.log_contact_intent(text, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.log_post_click(text, text, text, text) from public, anon, authenticated;

-- archived rows are never purged (the cron skips them too)
create or replace function public.purge_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'listings are archived (read-only)' using errcode = '42501';
end $$;

alter policy post_clicks_staff_read on public.post_clicks using ((select private.is_admin()));

-- handover / user deletion: archived units are not "work" any more
create or replace function public.reassign_all(p_from uuid, p_to uuid)
returns table (units int, leads int, consign int)
language plpgsql security definer set search_path = '' as $$
declare n_leads int; n_consign int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'same user' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_to and active) then
    raise exception 'target user is not an active staff member' using errcode = '22023';
  end if;
  select count(*) into n_consign from public.leads
   where assigned_to = p_from and status not in ('won', 'lost') and type = 'consign';
  update public.leads set assigned_to = p_to where assigned_to = p_from and status not in ('won', 'lost');
  get diagnostics n_leads = row_count;
  return query select 0, n_leads - n_consign, n_consign;
end $$;

create or replace function public.user_holdings(p_user uuid)
returns table (units int, open_leads int)
language sql stable security definer set search_path = '' as $$
  select 0,
         (select count(*)::int from public.leads d where d.assigned_to = p_user and d.status not in ('won', 'lost') and d.deleted_at is null)
   where private.is_admin() or private.is_trusted()
$$;

-- ───────────────────────── unit types ─────────────────────────
create table public.unit_types (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete restrict,
  type text not null check (type in ('studio', '1pn', '2pn', '3pn')),
  -- {PREFIX}-{TYPE}, kept in step with the building prefix by triggers
  code text not null unique check (code ~ '^[A-Z]{3}-(STUDIO|1PN|2PN|3PN)$'),
  area_min numeric(6, 1) check (area_min > 0 and area_min < 1000),
  area_max numeric(6, 1) check (area_max > 0 and area_max < 1000),
  -- "from" monthly rent, VND
  price_from bigint check (price_from between 100000 and 1000000000),
  price_updated_at timestamptz,
  furniture_note text check (length(furniture_note) <= 500),
  view_note text check (length(view_note) <= 500),
  features text[] not null default '{}' check (features <@ array[
    'sea_view', 'city_view', 'river_view', 'lagoon_view', 'balcony', 'workspace', 'bathtub', 'washer', 'kitchen', 'furnished', 'pets_ok']),
  desc_vi text check (length(desc_vi) <= 5000),
  desc_en text check (length(desc_en) <= 5000),
  desc_ru text check (length(desc_ru) <= 5000),
  desc_en_vi_hash text check (desc_en_vi_hash is null or desc_en_vi_hash ~ '^[0-9a-f]{64}$'),
  is_visible boolean not null default false,
  sort int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  unique (building_id, type),
  check (area_min is null or area_max is null or area_max >= area_min),
  -- the site shows a price and an area for every visible type: nothing is shown half-filled
  check (not is_visible or (price_from is not null and area_min is not null))
);
create index unit_types_building_idx on public.unit_types (building_id, sort);
create index unit_types_deleted_idx on public.unit_types (deleted_at) where deleted_at is not null;
create index unit_types_updated_by_idx on public.unit_types (updated_by);
create index unit_types_created_by_idx on public.unit_types (created_by);
create index unit_types_deleted_by_idx on public.unit_types (deleted_by);

create function private.unit_type_order(t text) returns int
language sql immutable as $$ select case t when 'studio' then 0 when '1pn' then 1 when '2pn' then 2 when '3pn' then 3 else 9 end $$;
grant execute on function private.unit_type_order(text) to anon, authenticated, service_role;

-- code from the building; building / type fixed after insert (the URL); price stamp; visibility needs publishing rights
create function private.guard_unit_types() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.building_id := old.building_id;
    new.type := old.type;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if (new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by)
       and not (private.is_trusted() or coalesce(current_setting('app.rpc', true), '') = 'on') then
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
    end if;
  elsif new.created_by is null then
    new.created_by := auth.uid();
  end if;
  select b.code_prefix || '-' || upper(new.type) into new.code from public.buildings b where b.id = new.building_id;
  if tg_op = 'INSERT' or new.price_from is distinct from old.price_from then
    new.price_updated_at := case when new.price_from is null then null else now() end;
  end if;
  if new.is_visible and (tg_op = 'INSERT' or not old.is_visible) and not (private.is_trusted() or private.can_publish()) then
    raise exception 'chỉ người có quyền đăng mới bật hiển thị loại căn' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.unit_types for each row execute function private.guard_unit_types();
create trigger stamp before insert or update on public.unit_types for each row execute function private.stamp();
create trigger track_en_source before insert or update on public.unit_types for each row execute function private.track_en_source();

-- a new / changed building prefix follows into the codes
create function private.sync_unit_type_codes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.unit_types set code = new.code_prefix || '-' || upper(type) where building_id = new.id;
  return new;
end $$;
create trigger sync_unit_type_codes after update of code_prefix on public.buildings
  for each row when (new.code_prefix is distinct from old.code_prefix) execute function private.sync_unit_type_codes();

-- every building gets its four hidden drafts
create function private.unit_type_drafts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.unit_types (building_id, type, sort)
  select new.id, t, private.unit_type_order(t) from unnest(array['studio', '1pn', '2pn', '3pn']) t
  on conflict (building_id, type) do nothing;
  return new;
end $$;
create trigger unit_type_drafts after insert on public.buildings for each row execute function private.unit_type_drafts();

-- the prefix is the building's URL (/ALT) once one of its types is public, as it was once a listing had a code
create or replace function private.guard_building_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.code_prefix := coalesce(new.code_prefix, upper(rpad(left(regexp_replace(new.slug, '[^a-z]', '', 'g'), 3), 3, 'X')));
    if current_user in ('anon', 'authenticated') then new.code_seq := 0; end if;
    return new;
  end if;
  if current_user in ('anon', 'authenticated') then new.code_seq := old.code_seq; end if;
  if new.code_seq < old.code_seq then new.code_seq := old.code_seq; end if;
  if new.code_prefix is distinct from old.code_prefix and (
    exists (select 1 from public.listings l join public.units u on u.id = l.unit_id where u.building_id = new.id and l.code is not null)
    or exists (select 1 from public.unit_types t where t.building_id = new.id and t.is_visible and t.deleted_at is null)
  ) then
    raise exception 'Toà nhà đã có trang công khai /%, không đổi được tiền tố', old.code_prefix using errcode = '42501';
  end if;
  return new;
end $$;

alter table public.unit_types enable row level security;
revoke all on public.unit_types from anon, authenticated;
grant select, insert, update on public.unit_types to authenticated;
grant all on public.unit_types to service_role;
-- staff work on unit types (making one visible needs publishing rights: trigger); trash / purge only through rpcs
create policy unit_types_staff_read on public.unit_types for select to authenticated
  using ((select private.is_staff()) and deleted_at is null);
create policy unit_types_staff_insert on public.unit_types for insert to authenticated
  with check ((select private.is_staff()) and deleted_at is null);
create policy unit_types_staff_update on public.unit_types for update to authenticated
  using ((select private.is_staff()) and deleted_at is null) with check ((select private.is_staff()) and deleted_at is null);

-- drafts for every building that exists now (values left empty: never guessed)
insert into public.unit_types (building_id, type, sort)
select b.id, t, private.unit_type_order(t)
from public.buildings b cross join unnest(array['studio', '1pn', '2pn', '3pn']) t
on conflict (building_id, type) do nothing;

-- ───────────────────────── photos of unit types ─────────────────────────
alter table public.photos add column unit_type_id uuid references public.unit_types (id) on delete cascade;
create index photos_unit_type_idx on public.photos (unit_type_id, sort);
create unique index photos_one_cover_unit_type on public.photos (unit_type_id) where is_cover and unit_type_id is not null;
alter table public.photos drop constraint photos_check;
alter table public.photos add constraint photos_check check (num_nonnulls(listing_id, building_id, unit_id, unit_type_id) = 1);
alter table public.photos add constraint photos_unit_type_public check (unit_type_id is null or visibility = 'public');

-- sample-unit photos are ours: watermarked by default, like listing photos were
create or replace function private.photos_watermark_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.watermark is null then
    new.watermark := (new.listing_id is not null or new.unit_type_id is not null) and new.source is distinct from 'reference';
  end if;
  return new;
end $$;

create or replace function private.guard_photos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.rpc', true), '') <> 'on' then
      new.listing_id := old.listing_id; new.building_id := old.building_id; new.unit_id := old.unit_id; new.unit_type_id := old.unit_type_id;
    end if;
    new.created_by := old.created_by;
  end if;
  return new;
end $$;

-- RLS: archived listing / unit photos → admins read only. Building photos: admins write. Unit type photos: staff write.
drop policy photos_admin_all on public.photos;
drop policy photos_sales_read on public.photos;
drop policy photos_sales_insert on public.photos;
drop policy photos_sales_update on public.photos;
drop policy photos_sales_delete on public.photos;
create policy photos_admin_read on public.photos for select to authenticated
  using ((select private.is_admin()) and deleted_at is null);
create policy photos_staff_read on public.photos for select to authenticated
  using (deleted_at is null and (building_id is not null or unit_type_id is not null) and (select private.is_staff()));
create policy photos_insert on public.photos for insert to authenticated
  with check (deleted_at is null and ((building_id is not null and (select private.is_admin())) or (unit_type_id is not null and (select private.is_staff()))));
create policy photos_update on public.photos for update to authenticated
  using (deleted_at is null and ((building_id is not null and (select private.is_admin())) or (unit_type_id is not null and (select private.is_staff()))))
  with check (deleted_at is null and ((building_id is not null and (select private.is_admin())) or (unit_type_id is not null and (select private.is_staff()))));
create policy photos_delete on public.photos for delete to authenticated
  using (deleted_at is null and ((building_id is not null and (select private.is_admin())) or (unit_type_id is not null and (select private.is_staff()))));

-- photo rpcs: archived photos are never edited, moved, trashed or purged
create or replace function private.can_edit_photo(p public.photos) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.listing_id is null and p.unit_id is null
     and (private.is_admin() or private.is_trusted() or (p.unit_type_id is not null and private.is_staff()))
$$;

create function private.ensure_cover_ut(p_unit_type uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_unit_type is null then return; end if;
  if exists (select 1 from public.photos where deleted_at is null and is_cover and unit_type_id = p_unit_type) then return; end if;
  update public.photos set is_cover = true where id = (
    select id from public.photos where deleted_at is null and visibility = 'public' and unit_type_id = p_unit_type
     order by sort, created_at limit 1);
end $$;

create or replace function private.photo_batch(p_ids uuid[], p_batch boolean) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case when not p_batch then p_ids else coalesce((
    select array_agg(x.id) from public.photos p join public.photos x
        on x.deleted_at = p.deleted_at and x.listing_id is not distinct from p.listing_id
       and x.building_id is not distinct from p.building_id and x.unit_id is not distinct from p.unit_id
       and x.unit_type_id is not distinct from p.unit_type_id
     where p.id = p_ids[1] and p.deleted_at is not null), '{}') end
$$;

create or replace function public.trash_photos(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; r record;
begin
  if cardinality(p_ids) > 200 then raise exception 'too many photos' using errcode = '22023'; end if;
  if exists (select 1 from public.photos p where p.id = any (p_ids) and p.deleted_at is null and not private.can_edit_photo(p)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.photos set deleted_at = now(), deleted_by = auth.uid(), is_cover = false where id = any (p_ids) and deleted_at is null;
  get diagnostics n = row_count;
  for r in select distinct building_id, unit_type_id from public.photos where id = any (p_ids) loop
    perform private.ensure_cover(null, r.building_id);
    perform private.ensure_cover_ut(r.unit_type_id);
  end loop;
  return n;
end $$;

create or replace function public.restore_photos(p_ids uuid[], p_batch boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare ids uuid[] := private.photo_batch(p_ids, p_batch); n int; r record;
begin
  if exists (select 1 from public.photos p where p.id = any (ids) and p.deleted_at is not null and not private.can_edit_photo(p)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.photos p join public.unit_types t on t.id = p.unit_type_id where p.id = any (ids) and t.deleted_at is not null) then
    raise exception 'unit type in trash' using errcode = '22023';
  end if;
  update public.photos set deleted_at = null, deleted_by = null where id = any (ids) and deleted_at is not null;
  get diagnostics n = row_count;
  for r in select distinct building_id, unit_type_id from public.photos where id = any (ids) loop
    perform private.ensure_cover(null, r.building_id);
    perform private.ensure_cover_ut(r.unit_type_id);
  end loop;
  return n;
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
  -- archived listing / unit photos stay, trashed or not
  select coalesce(array_agg(id), '{}') into ids from public.photos
   where id = any (ids) and deleted_at is not null and listing_id is null and unit_id is null;
  files := private.photo_files(ids);
  delete from public.photos where id = any (ids);
  return files;
end $$;

create or replace function public.set_photo_cover(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.photos;
begin
  select * into p from public.photos where id = p_id and deleted_at is null and unit_id is null for update;
  if not found then raise exception 'photo not found' using errcode = '22023'; end if;
  if not private.can_edit_photo(p) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p.visibility <> 'public' then raise exception 'internal photo' using errcode = '22023'; end if;
  update public.photos set is_cover = false
   where is_cover and id <> p_id
     and ((p.building_id is not null and building_id = p.building_id) or (p.unit_type_id is not null and unit_type_id = p.unit_type_id));
  update public.photos q set is_cover = (q.id = p_id), sort = o.pos
    from (select id, (row_number() over (order by (id = p_id) desc, sort, created_at) - 1)::int as pos
            from public.photos
           where deleted_at is null
             and ((p.building_id is not null and building_id = p.building_id) or (p.unit_type_id is not null and unit_type_id = p.unit_type_id))) o
   where q.id = o.id and (q.sort is distinct from o.pos or q.is_cover is distinct from (q.id = p_id));
end $$;

-- move between a building and its unit types (same building only). p_kind 'unit_type' | 'building'.
drop function public.move_photos(uuid[], text, uuid);
create function public.move_photos(p_ids uuid[], p_kind text, p_target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t_building uuid; ids uuid[]; src_t uuid[]; src_b uuid[]; bad boolean; other boolean;
  n int; base int; need jsonb; x uuid;
begin
  if cardinality(p_ids) > 200 then raise exception 'too many photos' using errcode = '22023'; end if;
  if p_kind = 'unit_type' then
    if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
    select t.building_id into t_building from public.unit_types t where t.id = p_target and t.deleted_at is null;
    if not found then raise exception 'target not found' using errcode = '22023'; end if;
  elsif p_kind = 'building' then
    if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
    select b.id into t_building from public.buildings b where b.id = p_target and b.deleted_at is null;
    if not found then raise exception 'target not found' using errcode = '22023'; end if;
  else raise exception 'bad target' using errcode = '22023';
  end if;

  select coalesce(array_agg(p.id order by p.sort, p.created_at), '{}'),
         coalesce(array_agg(distinct p.unit_type_id) filter (where p.unit_type_id is not null), '{}'),
         coalesce(array_agg(distinct p.building_id) filter (where p.building_id is not null), '{}'),
         coalesce(bool_or(not private.can_edit_photo(p)), false),
         coalesce(bool_or(coalesce(p.building_id, (select t.building_id from public.unit_types t where t.id = p.unit_type_id)) is distinct from t_building), false)
    into ids, src_t, src_b, bad, other
    from public.photos p
   where p.id = any (p_ids) and p.deleted_at is null
     and not ((p_kind = 'unit_type' and p.unit_type_id is not distinct from p_target) or (p_kind = 'building' and p.building_id is not distinct from p_target));
  if bad then raise exception 'not allowed' using errcode = '42501'; end if;
  if other then raise exception 'other building' using errcode = '22023'; end if;

  select coalesce(max(p.sort), -1) + 1 into base from public.photos p
   where p.deleted_at is null and ((p_kind = 'unit_type' and p.unit_type_id = p_target) or (p_kind = 'building' and p.building_id = p_target));
  perform set_config('app.rpc', 'on', true);
  update public.photos p set
    unit_type_id = case when p_kind = 'unit_type' then p_target end,
    building_id = case when p_kind = 'building' then p_target end,
    is_cover = false, sort = base + array_position(ids, p.id) - 1
  where p.id = any (ids);
  get diagnostics n = row_count;
  perform set_config('app.rpc', 'off', true);

  foreach x in array src_t loop perform private.ensure_cover_ut(x); end loop;
  foreach x in array src_b loop perform private.ensure_cover(null, x); end loop;
  if p_kind = 'unit_type' then perform private.ensure_cover_ut(p_target); else perform private.ensure_cover(null, p_target); end if;

  select coalesce(jsonb_agg(p.id), '[]'::jsonb) into need from public.photos p
   where p.id = any (ids) and p_kind = 'unit_type' and p.visibility = 'public' and not p.watermark and p.source is distinct from 'reference';
  return jsonb_build_object('moved', n, 'need_watermark', need);
end $$;
revoke all on function public.move_photos(uuid[], text, uuid) from public, anon;
grant execute on function public.move_photos(uuid[], text, uuid) to authenticated, service_role;

-- storage: unit-types/<id>/ for staff; archived listings/ + units/ folders are read-only for everyone
create or replace function private.can_write_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) in ('listings', 'units') then false
    when private.is_admin() then p_bucket in ('listing-public', 'listing-internal', 'listing-master')
    when p_bucket in ('listing-public', 'listing-master') and split_part(p_name, '/', 1) = 'unit-types'
      then private.is_staff() and exists (select 1 from public.unit_types t where t.id = private.try_uuid(split_part(p_name, '/', 2)) and t.deleted_at is null)
    else false
  end
$$;
alter policy aqn_staff_delete on storage.objects
  using (bucket_id in ('listing-public', 'listing-internal', 'listing-master', 'consign-inbox')
         and (private.can_write_object(bucket_id, name) or (bucket_id = 'consign-inbox' and private.is_admin())));

-- ───────────────────────── leads ─────────────────────────
alter table public.leads
  add column unit_type_id uuid references public.unit_types (id) on delete set null,
  -- the code at the time of the request (kept when the type is purged)
  add column unit_type_code text check (unit_type_code is null or unit_type_code ~ '^[A-Z]{3}-(STUDIO|1PN|2PN|3PN)$');
create index leads_unit_type_idx on public.leads (unit_type_id);

create or replace function private.guard_leads() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.assigned_to := auth.uid();
    if new.type = 'consign' or cardinality(new.photo_paths) > 0 then
      raise exception 'only the website creates consign leads' using errcode = '42501';
    end if;
  else
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'only admins can reassign' using errcode = '42501';
    end if;
    if new.type is distinct from old.type or new.payload is distinct from old.payload
       or new.photo_paths is distinct from old.photo_paths or new.listing_id is distinct from old.listing_id
       or new.unit_type_id is distinct from old.unit_type_id or new.unit_type_code is distinct from old.unit_type_code then
      raise exception 'only admins can change the request' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- chat taps may now name a unit type (and Zalo, the Vietnamese "Kiểm tra căn trống")
alter table public.contact_intents drop constraint contact_intents_code_check;
alter table public.contact_intents add constraint contact_intents_code_check
  check (code is null or code ~ '^[A-Z]{3}-([0-9]{3,6}|STUDIO|1PN|2PN|3PN)$');
alter table public.contact_intents drop constraint contact_intents_channel_check;
alter table public.contact_intents add constraint contact_intents_channel_check check (channel in ('whatsapp', 'telegram', 'zalo'));

create or replace function public.log_chat_intent(p_code text, p_channel text, p_origin text, p_src text, p_source text, p_content text, p_page text, p_locale text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_intents where created_at > now() - interval '1 minute') >= 60 then return false; end if;
  if nullif(p_code, '') is not null and not exists (
    select 1 from public.unit_types t join public.buildings b on b.id = t.building_id
     where t.code = upper(p_code) and t.is_visible and t.deleted_at is null and b.is_visible and b.deleted_at is null) then return false; end if;
  insert into public.contact_intents (code, channel, origin, src, utm_source, utm_content, page, locale)
  values (upper(nullif(p_code, '')), p_channel, nullif(p_origin, ''), nullif(p_src, ''), nullif(left(p_source, 40), ''), nullif(left(p_content, 80), ''), nullif(left(p_page, 200), ''), p_locale);
  return true;
exception when check_violation or not_null_violation then
  return false;
end $$;

-- ───────────────────────── public views + redirects ─────────────────────────
create view public.public_unit_types with (security_barrier = true) as
select
  t.code, b.slug as building_slug, b.code_prefix, t.type, t.area_min, t.area_max, t.price_from, t.price_updated_at,
  t.furniture_note, t.view_note, t.features, t.desc_vi, t.desc_en, t.desc_ru, t.sort, t.updated_at, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.unit_type_id = t.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos
from public.unit_types t
join public.buildings b on b.id = t.building_id
where t.is_visible and t.deleted_at is null and b.deleted_at is null and b.is_visible;
revoke all on public.public_unit_types from anon, authenticated;
grant select on public.public_unit_types to anon, authenticated, service_role;

-- Old listing URL (/{CODE}, QN-### too) → where it lives now: the visible unit type of the same building + bedrooms
-- ('ALT-2PN'), else the visible building ('ALT'), else null (404). Nothing else about the listing leaves the database.
create function public.listing_redirect(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  with l as (
    select u.building_id,
           case when x.beds is null then null when x.beds <= 0 then 'studio' when x.beds = 1 then '1pn' when x.beds = 2 then '2pn' else '3pn' end as type
      from public.listings x join public.units u on u.id = x.unit_id
     where x.code = upper(p_code) or x.legacy_code = upper(p_code)
     order by (x.code = upper(p_code)) desc
     limit 1)
  select coalesce(
    (select t.code from l join public.unit_types t on t.building_id = l.building_id and t.type = l.type
       join public.buildings b on b.id = t.building_id
      where t.is_visible and t.deleted_at is null and b.is_visible and b.deleted_at is null),
    (select b.code_prefix from l join public.buildings b on b.id = l.building_id where b.is_visible and b.deleted_at is null))
$$;
revoke all on function public.listing_redirect(text) from public;
grant execute on function public.listing_redirect(text) to anon, authenticated, service_role;

-- A hidden unit type / building: its page redirects (building → home) instead of 404.
create function public.unit_type_building(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select b.code_prefix from public.unit_types t join public.buildings b on b.id = t.building_id
   where t.code = upper(p_code) and t.deleted_at is null and b.deleted_at is null and b.is_visible
$$;
revoke all on function public.unit_type_building(text) from public;
grant execute on function public.unit_type_building(text) to anon, authenticated, service_role;

-- admin list: one row per unit type with what is still missing
create view public.admin_unit_types with (security_invoker = true) as
select
  t.id, t.building_id, t.type, t.code, t.area_min, t.area_max, t.price_from, t.price_updated_at, t.furniture_note, t.view_note,
  t.features, t.desc_vi is not null and btrim(t.desc_vi) <> '' as has_vi, t.is_visible, t.sort, t.updated_at, t.updated_by, t.created_at,
  b.name as building_name, b.slug as building_slug, b.code_prefix, b.sort as building_sort, b.is_visible as building_visible, b.is_demo as building_demo,
  (select count(*) from public.photos p where p.unit_type_id = t.id and p.deleted_at is null)::int as photo_count,
  (select p.thumb_path from public.photos p where p.unit_type_id = t.id and p.deleted_at is null order by p.is_cover desc, p.sort limit 1) as cover_thumb,
  private.en_status(t.desc_vi, t.desc_en, t.desc_en_vi_hash) as en_status
from public.unit_types t
join public.buildings b on b.id = t.building_id
where t.deleted_at is null and b.deleted_at is null;
revoke all on public.admin_unit_types from anon, authenticated;
grant select on public.admin_unit_types to authenticated, service_role;

-- ───────────────────────── unit type trash ─────────────────────────
create function public.trash_unit_type(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.unit_types set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  if not found then raise exception 'unit type not found' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'off', true);
end $$;

create function public.restore_unit_type(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if exists (select 1 from public.unit_types t join public.buildings b on b.id = t.building_id where t.id = p_id and b.deleted_at is not null) then
    raise exception 'toà nhà của loại căn này đang trong thùng rác, khôi phục toà nhà trước' using errcode = '22023';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.unit_types set deleted_at = null, deleted_by = null where id = p_id and deleted_at is not null;
  if not found then raise exception 'unit type is not in the trash' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'off', true);
end $$;

-- hard delete (admin from Thùng rác, or the daily cron after 30 days): returns the storage objects to remove
create function public.purge_unit_type(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare files jsonb;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  if not exists (select 1 from public.unit_types where id = p_id and deleted_at is not null) then
    raise exception 'unit type is not in the trash' using errcode = '22023';
  end if;
  files := private.photo_objects('unit_type_id', p_id);
  update public.leads set unit_type_code = coalesce(unit_type_code, (select code from public.unit_types where id = p_id)) where unit_type_id = p_id;
  delete from public.unit_types where id = p_id;      -- photos cascade; leads.unit_type_id → null
  return files;
end $$;

revoke all on function public.trash_unit_type(uuid), public.restore_unit_type(uuid), public.purge_unit_type(uuid) from public, anon;
grant execute on function public.trash_unit_type(uuid), public.restore_unit_type(uuid), public.purge_unit_type(uuid) to authenticated, service_role;

-- buildings: trash when nothing of theirs is public; purge takes the (trashed or draft) unit types with them,
-- but never a building that still holds archived units
create or replace function public.trash_building(p_building uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select count(*) into n from public.unit_types t where t.building_id = p_building and t.is_visible and t.deleted_at is null;
  if n > 0 then raise exception 'toà nhà còn % loại căn đang hiển thị — ẩn trước', n using errcode = '23503'; end if;
  update public.buildings set deleted_at = now(), deleted_by = auth.uid() where id = p_building and deleted_at is null;
  if not found then raise exception 'building not found' using errcode = '22023'; end if;
end $$;

create or replace function public.purge_building(p_building uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.buildings; files jsonb; ids uuid[];
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into b from public.buildings where id = p_building and deleted_at is not null;
  if not found then raise exception 'building is not in the trash' using errcode = '22023'; end if;
  if exists (select 1 from public.units where building_id = b.id) then
    raise exception 'building still has archived units' using errcode = '23503';
  end if;
  select coalesce(array_agg(p.id), '{}') into ids from public.photos p
   where p.building_id = b.id or p.unit_type_id in (select t.id from public.unit_types t where t.building_id = b.id);
  files := private.photo_files(ids);
  insert into public.reserved_prefixes (prefix, building_name) values (b.code_prefix, b.name) on conflict (prefix) do nothing;
  update public.consign_inbox set building_id = null where building_id = b.id;
  update public.leads d set unit_type_code = coalesce(d.unit_type_code, t.code) from public.unit_types t where t.id = d.unit_type_id and t.building_id = b.id;
  delete from public.unit_types where building_id = b.id;
  delete from public.buildings where id = b.id;
  return files;
end $$;

-- Thùng rác: buildings, unit types, leads, photos (archived listings are in "Lưu trữ", not here)
create or replace function public.trash_items()
returns table (kind text, id uuid, label text, detail text, deleted_at timestamptz, deleted_by uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
    select 'unit_type', t.id, t.code || ' · ' || b.name,
           'Loại căn' || case when b.deleted_at is not null then ' · toà nhà cũng đã xoá' else '' end, t.deleted_at, t.deleted_by
      from public.unit_types t join public.buildings b on b.id = t.building_id
     where t.deleted_at is not null
    union all
    select 'building', b.id, b.name, b.code_prefix || ' · /' || b.slug, b.deleted_at, b.deleted_by
      from public.buildings b where b.deleted_at is not null
    union all
    select 'lead', d.id, d.name, d.phone || ' · ' || d.type || coalesce(' · ' || coalesce(t.code, d.unit_type_code), ''), d.deleted_at, d.deleted_by
      from public.leads d left join public.unit_types t on t.id = d.unit_type_id where d.deleted_at is not null
    union all
    select 'photo', (array_agg(p.id order by p.sort, p.id))[1], count(*) || ' ảnh',
           coalesce(max('Loại căn ' || t.code), max('Toà nhà ' || pb.name), 'Ảnh'),
           p.deleted_at, (array_agg(p.deleted_by))[1]
      from public.photos p
      left join public.unit_types t on t.id = p.unit_type_id
      left join public.buildings pb on pb.id = p.building_id
     where p.deleted_at is not null and p.listing_id is null and p.unit_id is null
     group by p.deleted_at, p.building_id, p.unit_type_id
    order by 5 desc;
end $$;
