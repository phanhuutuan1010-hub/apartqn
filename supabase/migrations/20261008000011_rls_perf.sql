-- ApartQN · 11 · RLS / index performance (no data or behaviour change)
-- 1. auth.uid() and the STABLE role helpers wrapped in (select …): Postgres evaluates them once per statement
--    (InitPlan) instead of once per row. Same expressions, same results — RLS tests cover every policy.
-- 2. indexes on foreign keys that had none (joins, filters, ON DELETE actions).

alter policy buildings_admin_delete on public.buildings using ((select private.is_admin()));
alter policy buildings_admin_insert on public.buildings with check ((select private.is_admin()));
alter policy buildings_admin_update on public.buildings using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy buildings_staff_read on public.buildings using ((select private.is_staff()));

alter policy consign_admin_all on public.consign_inbox using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy consign_assignee_read on public.consign_inbox
  using (assigned_to = (select auth.uid()) and status = 'assigned'::public.consign_status and (select private.is_staff()));

alter policy leads_admin_all on public.leads using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy leads_sales_insert on public.leads with check ((select private.is_staff()));
alter policy leads_sales_read on public.leads using (assigned_to = (select auth.uid()) and (select private.is_staff()));
alter policy leads_sales_update on public.leads
  using (assigned_to = (select auth.uid()) and (select private.is_staff())) with check (assigned_to = (select auth.uid()));

alter policy listings_admin_all on public.listings using ((select private.is_admin())) with check ((select private.is_admin()));

alter policy photos_admin_all on public.photos using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy photos_sales_read on public.photos
  using ((listing_id is not null and private.owns_listing(listing_id))
      or (unit_id is not null and private.owns_unit(unit_id))
      or (building_id is not null and visibility = 'public'::public.photo_visibility and (select private.is_staff())));

alter policy profiles_admin_all on public.profiles using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy profiles_self_read on public.profiles using (id = (select auth.uid()) and (select private.is_staff()));
alter policy profiles_self_update on public.profiles
  using (id = (select auth.uid()) and (select private.is_staff())) with check (id = (select auth.uid()));

alter policy search_misses_admin_read on public.search_misses using ((select private.is_admin()));

alter policy settings_admin_write on public.settings using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy settings_staff_read on public.settings using ((select private.is_staff()));

alter policy units_admin_all on public.units using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy units_sales_insert on public.units with check ((select private.is_staff()));
alter policy units_sales_read on public.units using (assigned_to = (select auth.uid()) and (select private.is_staff()));
alter policy units_sales_update on public.units
  using (assigned_to = (select auth.uid()) and (select private.is_staff())) with check (assigned_to = (select auth.uid()));

create index if not exists listings_created_by_idx on public.listings (created_by);
create index if not exists listings_updated_by_idx on public.listings (updated_by);
create index if not exists listings_updated_at_idx on public.listings (updated_at desc);
create index if not exists units_created_by_idx on public.units (created_by);
create index if not exists units_updated_by_idx on public.units (updated_by);
create index if not exists leads_listing_idx on public.leads (listing_id);
create index if not exists leads_updated_by_idx on public.leads (updated_by);
create index if not exists consign_assigned_idx on public.consign_inbox (assigned_to, status);
create index if not exists consign_listing_idx on public.consign_inbox (listing_id);
create index if not exists consign_unit_idx on public.consign_inbox (unit_id);
create index if not exists consign_building_idx on public.consign_inbox (building_id);
create index if not exists consign_updated_by_idx on public.consign_inbox (updated_by);
create index if not exists photos_created_by_idx on public.photos (created_by);
create index if not exists buildings_updated_by_idx on public.buildings (updated_by);
create index if not exists settings_updated_by_idx on public.settings (updated_by);
