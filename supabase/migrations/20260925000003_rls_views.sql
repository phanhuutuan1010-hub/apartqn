-- ApartQN · 3/5 · RLS, grants, public views
-- Principle: RLS on every table; anon reads ONLY the public_* views (curated columns, no unit/owner data).
-- Supabase grants ALL on new public tables to anon/authenticated by default — revoke explicitly.

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.listings enable row level security;
alter table public.photos enable row level security;
alter table public.consign_inbox enable row level security;
alter table public.leads enable row level security;

revoke all on public.profiles, public.settings, public.buildings, public.units, public.listings,
  public.photos, public.consign_inbox, public.leads from anon, authenticated;
revoke all on sequence public.listing_code_seq from anon, authenticated;

grant select, insert, update, delete on public.profiles, public.settings, public.buildings, public.units,
  public.listings, public.photos, public.consign_inbox, public.leads to authenticated;
grant all on public.profiles, public.settings, public.buildings, public.units, public.listings,
  public.photos, public.consign_inbox, public.leads to service_role;
grant usage on sequence public.listing_code_seq to service_role;

-- ───────────────────────── profiles ─────────────────────────
create policy profiles_admin_all on public.profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() and private.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() and private.is_staff()) with check (id = auth.uid());
-- delete is admin-only via profiles_admin_all (and cascades from auth.users)

-- ───────────────────────── settings ─────────────────────────
create policy settings_staff_read on public.settings for select to authenticated using (private.is_staff());
create policy settings_admin_write on public.settings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ───────────────────────── buildings ─────────────────────────
create policy buildings_staff_read on public.buildings for select to authenticated using (private.is_staff());
create policy buildings_admin_insert on public.buildings for insert to authenticated with check (private.is_admin());
create policy buildings_admin_update on public.buildings for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy buildings_admin_delete on public.buildings for delete to authenticated using (private.is_admin());

-- ───────────────────────── units (owner data) ─────────────────────────
create policy units_admin_all on public.units for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy units_sales_read on public.units for select to authenticated
  using (assigned_to = auth.uid() and private.is_staff());
create policy units_sales_insert on public.units for insert to authenticated
  with check (private.is_staff());                       -- trigger forces assigned_to = auth.uid()
create policy units_sales_update on public.units for update to authenticated
  using (assigned_to = auth.uid() and private.is_staff()) with check (assigned_to = auth.uid());

-- ───────────────────────── listings ─────────────────────────
create policy listings_admin_all on public.listings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy listings_sales_read on public.listings for select to authenticated
  using (private.owns_unit(unit_id));
create policy listings_sales_insert on public.listings for insert to authenticated
  with check (private.owns_unit(unit_id));
create policy listings_sales_update on public.listings for update to authenticated
  using (private.owns_unit(unit_id)) with check (private.owns_unit(unit_id));
-- delete: admin only

-- ───────────────────────── photos ─────────────────────────
create policy photos_admin_all on public.photos for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy photos_sales_read on public.photos for select to authenticated
  using ((listing_id is not null and private.owns_listing(listing_id))
      or (unit_id is not null and private.owns_unit(unit_id))
      or (building_id is not null and visibility = 'public' and private.is_staff()));
create policy photos_sales_insert on public.photos for insert to authenticated
  with check ((listing_id is not null and private.owns_listing(listing_id))
           or (unit_id is not null and private.owns_unit(unit_id)));
create policy photos_sales_update on public.photos for update to authenticated
  using ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id)))
  with check ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id)));
create policy photos_sales_delete on public.photos for delete to authenticated
  using ((listing_id is not null and private.owns_listing(listing_id)) or (unit_id is not null and private.owns_unit(unit_id)));

-- ───────────────────────── consign inbox: admin only until assigned ─────────────────────────
create policy consign_admin_all on public.consign_inbox for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy consign_assignee_read on public.consign_inbox for select to authenticated
  using (assigned_to = auth.uid() and status = 'assigned' and private.is_staff());
-- inserts come from the website through the server (service_role)

-- ───────────────────────── leads ─────────────────────────
create policy leads_admin_all on public.leads for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy leads_sales_read on public.leads for select to authenticated
  using (assigned_to = auth.uid() and private.is_staff());
create policy leads_sales_insert on public.leads for insert to authenticated
  with check (private.is_staff());                       -- trigger forces assigned_to = auth.uid()
create policy leads_sales_update on public.leads for update to authenticated
  using (assigned_to = auth.uid() and private.is_staff()) with check (assigned_to = auth.uid());

-- ───────────────────────── public views (anon) ─────────────────────────
-- Owner-privileged views: they deliberately bypass RLS and expose only whitelisted columns/rows.
create view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public'), '[]'::jsonb) as photos
from public.buildings b;

create view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, u.floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public'), '[]'::jsonb) as photos
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented');

revoke all on public.public_buildings, public.public_listings from anon, authenticated;
grant select on public.public_buildings, public.public_listings to anon, authenticated, service_role;
