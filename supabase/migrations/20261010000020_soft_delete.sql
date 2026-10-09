-- ApartQN · 20 · soft delete + trash for listings, buildings, leads; user deletion keeps an anonymised profile
-- Deleted rows get deleted_at / deleted_by. RLS hides them from every normal query (admin and sales alike), the public
-- views and admin_listings filter them out, and only the SECURITY DEFINER rpcs below can delete, list, restore or purge.
-- Purge (hard delete) returns the storage paths the caller must remove; the daily cron purges rows trashed > 30 days.
-- Additive except: profiles.email nullable and profiles → auth.users FK dropped (a deleted user keeps an anonymised profile).

-- ───────────── columns ─────────────
alter table public.listings
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  add column status_before_delete public.listing_status;
alter table public.buildings
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;
alter table public.leads
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  -- the listing code at the time its listing was purged (listing_id then becomes null)
  add column listing_code text;
create index listings_deleted_idx on public.listings (deleted_at) where deleted_at is not null;
create index buildings_deleted_idx on public.buildings (deleted_at) where deleted_at is not null;
create index leads_deleted_idx on public.leads (deleted_at) where deleted_at is not null;

alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles alter column email drop not null;
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- code prefixes of purged buildings: never handed out again
create table public.reserved_prefixes (
  prefix text primary key check (prefix ~ '^[A-Z]{3}$'),
  building_name text,
  reserved_at timestamptz not null default now()
);
alter table public.reserved_prefixes enable row level security;
revoke all on public.reserved_prefixes from anon, authenticated;
grant select on public.reserved_prefixes to authenticated;
grant all on public.reserved_prefixes to service_role;
create policy reserved_prefixes_staff_read on public.reserved_prefixes for select to authenticated using ((select private.is_staff()));

create function private.guard_reserved_prefix() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.code_prefix is distinct from old.code_prefix)
     and exists (select 1 from public.reserved_prefixes r where r.prefix = new.code_prefix) then
    raise exception 'Tiền tố % đã dùng cho một toà nhà đã xoá, chọn tiền tố khác', new.code_prefix using errcode = '23505';
  end if;
  return new;
end $$;
create trigger guard_reserved_prefix before insert or update on public.buildings
  for each row execute function private.guard_reserved_prefix();

-- ───────────── RLS: deleted rows are invisible and unwritable through normal access ─────────────
alter policy listings_admin_all on public.listings
  using ((select private.is_admin()) and deleted_at is null) with check ((select private.is_admin()) and deleted_at is null);
alter policy listings_sales_read on public.listings using (private.owns_unit(unit_id) and deleted_at is null);
alter policy listings_sales_update on public.listings
  using (private.owns_unit(unit_id) and deleted_at is null) with check (private.owns_unit(unit_id) and deleted_at is null);
alter policy listings_sales_insert on public.listings with check (private.owns_unit(unit_id) and deleted_at is null);

alter policy buildings_staff_read on public.buildings using ((select private.is_staff()) and deleted_at is null);
alter policy buildings_admin_update on public.buildings
  using ((select private.is_admin()) and deleted_at is null) with check ((select private.is_admin()) and deleted_at is null);
alter policy buildings_admin_insert on public.buildings with check ((select private.is_admin()) and deleted_at is null);
-- hard delete only through purge_building
drop policy buildings_admin_delete on public.buildings;

alter policy leads_admin_all on public.leads
  using ((select private.is_admin()) and deleted_at is null) with check ((select private.is_admin()) and deleted_at is null);
alter policy leads_sales_read on public.leads using (assigned_to = (select auth.uid()) and (select private.is_staff()) and deleted_at is null);
alter policy leads_sales_update on public.leads
  using (assigned_to = (select auth.uid()) and (select private.is_staff()) and deleted_at is null)
  with check (assigned_to = (select auth.uid()) and deleted_at is null);
alter policy leads_sales_insert on public.leads with check ((select private.is_staff()) and deleted_at is null);

-- a deleted user can never act again, even with a live session
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.deleted_at is null)
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.deleted_at is null and p.role = 'admin')
$$;

-- ───────────── views: no deleted rows ─────────────
create or replace view public.admin_listings with (security_invoker = true) as
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
join public.buildings b on b.id = u.building_id
where l.deleted_at is null and b.deleted_at is null;

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
where b.deleted_at is null;

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
  and l.deleted_at is null and b.deleted_at is null;

-- ───────────── rpc: trash / restore ─────────────
-- Listing → trash. Admin: any. Sales: own listing that was never published (no code). Public listings are unpublished.
create function public.trash_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing and deleted_at is null;
  if not found then raise exception 'listing not found' using errcode = '22023'; end if;
  if not (private.is_admin() or (private.owns_unit(l.unit_id) and l.code is null)) then
    raise exception 'chỉ quản trị viên xoá được tin đã từng đăng' using errcode = '42501';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.listings set deleted_at = now(), deleted_by = auth.uid(), status_before_delete = l.status,
         status = case when private.is_public_status(l.status) or l.status = 'pending' then 'hidden' else l.status end
   where id = p_listing;
  perform set_config('app.rpc', 'off', true);
end $$;

-- Restore: admin; or whoever trashed it within 10 minutes (the "Hoàn tác" toast).
create function public.restore_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing and deleted_at is not null;
  if not found then raise exception 'listing is not in the trash' using errcode = '22023'; end if;
  if not (private.is_admin() or (private.is_staff() and l.deleted_by = auth.uid() and l.deleted_at > now() - interval '10 minutes')) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if exists (select 1 from public.units u join public.buildings b on b.id = u.building_id where u.id = l.unit_id and b.deleted_at is not null) then
    raise exception 'toà nhà của căn này đang trong thùng rác, khôi phục toà nhà trước' using errcode = '22023';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.listings set deleted_at = null, deleted_by = null, status = coalesce(l.status_before_delete, l.status), status_before_delete = null
   where id = p_listing;
  perform set_config('app.rpc', 'off', true);
end $$;

-- Building → trash: admin, and only when no listing / unit references it (trashed ones included).
create function public.trash_building(p_building uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select count(*) into n from public.units u where u.building_id = p_building;
  if n > 0 then raise exception 'toà nhà còn % căn (kể cả căn trong thùng rác)', n using errcode = '23503'; end if;
  update public.buildings set deleted_at = now(), deleted_by = auth.uid() where id = p_building and deleted_at is null;
  if not found then raise exception 'building not found' using errcode = '22023'; end if;
end $$;

create function public.restore_building(p_building uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.buildings set deleted_at = null, deleted_by = null where id = p_building and deleted_at is not null;
  if not found then raise exception 'building is not in the trash' using errcode = '22023'; end if;
end $$;

-- Leads → trash / back (admin; bulk). Returns how many changed.
create function public.trash_leads(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.leads set deleted_at = now(), deleted_by = auth.uid() where id = any (p_ids) and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.restore_leads(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.leads set deleted_at = null, deleted_by = null where id = any (p_ids) and deleted_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Trash contents for the admin "Thùng rác" page.
create function public.trash_items()
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
    order by 5 desc;
end $$;

-- ───────────── rpc: purge (hard delete) ─────────────
-- Each returns the storage objects to remove ([{bucket, path}]); the caller deletes the files.
-- Admin (trashed rows only) or the server (service_role: the daily cron).

create function private.photo_objects(p_where text, p_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  execute format($q$
    select coalesce(jsonb_agg(o), '[]'::jsonb) from (
      select jsonb_build_object('bucket', p.bucket, 'path', p.path) as o from public.photos p where p.%1$I = $1
      union all select jsonb_build_object('bucket', p.bucket, 'path', p.thumb_path) from public.photos p where p.%1$I = $1 and p.thumb_path is not null
      union all select jsonb_build_object('bucket', 'listing-master', 'path', p.master_path) from public.photos p where p.%1$I = $1 and p.master_path is not null
    ) s$q$, p_where) into r using p_id;
  return r;
end $$;

create function public.purge_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings; files jsonb;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into l from public.listings where id = p_listing and deleted_at is not null;
  if not found then raise exception 'listing is not in the trash' using errcode = '22023'; end if;
  files := private.photo_objects('listing_id', l.id) || private.photo_objects('unit_id', l.unit_id);
  update public.leads set listing_code = coalesce(listing_code, l.code) where listing_id = l.id;
  update public.consign_inbox set listing_id = null, unit_id = null where listing_id = l.id or unit_id = l.unit_id;
  delete from public.listings where id = l.id;          -- photos cascade; leads.listing_id → null
  delete from public.units where id = l.unit_id and not exists (select 1 from public.listings x where x.unit_id = l.unit_id);
  return files;
end $$;

create function public.purge_building(p_building uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.buildings; files jsonb;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into b from public.buildings where id = p_building and deleted_at is not null;
  if not found then raise exception 'building is not in the trash' using errcode = '22023'; end if;
  if exists (select 1 from public.units where building_id = b.id) then
    raise exception 'building still has units' using errcode = '23503';
  end if;
  files := private.photo_objects('building_id', b.id);
  insert into public.reserved_prefixes (prefix, building_name) values (b.code_prefix, b.name) on conflict (prefix) do nothing;
  update public.consign_inbox set building_id = null where building_id = b.id;
  delete from public.buildings where id = b.id;
  return files;
end $$;

-- Leads: trashed ones, or any lead right away (p_now: a person asked for their data to be removed).
create function public.purge_lead(p_lead uuid, p_now boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.leads;
begin
  if not (private.is_admin() or private.is_trusted()) then raise exception 'admin only' using errcode = '42501'; end if;
  select * into d from public.leads where id = p_lead and (p_now or deleted_at is not null);
  if not found then raise exception 'lead is not in the trash' using errcode = '22023'; end if;
  delete from public.leads where id = d.id;
  return coalesce((select jsonb_agg(jsonb_build_object('bucket', 'consign-inbox', 'path', x)) from unnest(d.photo_paths) x), '[]'::jsonb);
end $$;

-- ───────────── users ─────────────
-- What still belongs to a user (blocks deletion until handed over with reassign_all).
create function public.user_holdings(p_user uuid)
returns table (units int, open_leads int)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.units u where u.assigned_to = p_user),
         (select count(*)::int from public.leads d where d.assigned_to = p_user and d.status not in ('won', 'lost') and d.deleted_at is null)
   where private.is_admin() or private.is_trusted()
$$;

revoke all on function public.trash_listing(uuid), public.restore_listing(uuid), public.trash_building(uuid), public.restore_building(uuid),
  public.trash_leads(uuid[]), public.restore_leads(uuid[]), public.trash_items(), public.purge_listing(uuid), public.purge_building(uuid),
  public.purge_lead(uuid, boolean), public.user_holdings(uuid) from public, anon;
grant execute on function public.trash_listing(uuid), public.restore_listing(uuid), public.trash_building(uuid), public.restore_building(uuid),
  public.trash_leads(uuid[]), public.restore_leads(uuid[]), public.trash_items(), public.purge_listing(uuid), public.purge_building(uuid),
  public.purge_lead(uuid, boolean), public.user_holdings(uuid) to authenticated, service_role;
revoke all on function private.photo_objects(text, uuid) from public, anon, authenticated;
