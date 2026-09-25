-- ApartQN · 2/5 · helper functions + integrity triggers
-- Helpers live in schema `private` (not exposed by the Data API). They are SECURITY DEFINER so
-- RLS policies can call them without recursive RLS on profiles/units.

-- ───────────────────────── role helpers ─────────────────────────
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active)
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin')
$$;

create function private.can_publish() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.active and (p.role = 'admin' or p.can_publish))
$$;

create function private.owns_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.units u where u.id = p_unit and u.assigned_to = auth.uid())
     and private.is_staff()
$$;

create function private.owns_listing(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l join public.units u on u.id = l.unit_id
                 where l.id = p_listing and u.assigned_to = auth.uid())
     and private.is_staff()
$$;

-- Trusted callers: service_role (server), table owner (migrations/seed) or our own SECURITY DEFINER rpc.
-- Never returns NULL (an unset GUC is NULL, and `IF NOT (NULL OR …)` would silently skip a guard).
create function private.is_trusted() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or coalesce(current_setting('app.rpc', true), '') = 'on'
      or (session_user in ('postgres', 'supabase_admin')
          and coalesce(current_setting('request.jwt.claims', true), '') in ('', '{}'))
$$;

grant usage on schema private to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on function private.is_staff(), private.is_admin(), private.can_publish(),
  private.owns_unit(uuid), private.owns_listing(uuid), private.is_trusted(),
  private.listing_is_complete(public.listings)
  to anon, authenticated, service_role;

-- ───────────────────────── generic stamp ─────────────────────────
create function private.stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- inserts keep a provided updated_at (seed/import); every update is stamped now
  if tg_op = 'UPDATE' or new.updated_at is null then
    new.updated_at := now();
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

create trigger stamp before insert or update on public.profiles for each row execute function private.stamp();
create trigger stamp before insert or update on public.settings for each row execute function private.stamp();
create trigger stamp before insert or update on public.buildings for each row execute function private.stamp();
create trigger stamp before insert or update on public.units for each row execute function private.stamp();
create trigger stamp before insert or update on public.listings for each row execute function private.stamp();
create trigger stamp before insert or update on public.consign_inbox for each row execute function private.stamp();
create trigger stamp before insert or update on public.leads for each row execute function private.stamp();

-- ───────────────────────── profiles ─────────────────────────
-- New auth user (invite) → profile. Role/can_publish are set by an admin afterwards.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create function private.guard_profiles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    raise exception 'profiles are created by invite only' using errcode = '42501';
  end if;
  if not private.is_admin() then
    if new.role is distinct from old.role or new.can_publish is distinct from old.can_publish
       or new.active is distinct from old.active or new.email is distinct from old.email then
      raise exception 'only admins can change role, publishing rights, email or active state' using errcode = '42501';
    end if;
  end if;
  new.id := old.id;
  -- never lock out the last active admin
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.profiles p where p.role = 'admin' and p.active and p.id <> old.id) then
    raise exception 'cannot demote or deactivate the last active admin' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.profiles for each row execute function private.guard_profiles();

-- ───────────────────────── units ─────────────────────────
create function private.guard_units() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin() then
    if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.assigned_to := auth.uid();          -- sales create units for themselves
  elsif new.assigned_to is distinct from old.assigned_to or new.created_by is distinct from old.created_by then
    raise exception 'only admins can reassign' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.units for each row execute function private.guard_units();

-- ───────────────────────── listings ─────────────────────────
create function private.is_public_status(s public.listing_status) returns boolean
language sql immutable as $$ select s in ('available', 'reserved', 'rented') $$;
grant execute on function private.is_public_status(public.listing_status) to anon, authenticated, service_role;

-- Code allocation runs as owner: API roles have no rights on the sequence.
create function private.next_listing_code() returns text
language sql volatile security definer set search_path = '' as $$
  select 'QN-' || lpad(nextval('public.listing_code_seq')::text, 3, '0')
$$;
revoke all on function private.next_listing_code() from public;
grant execute on function private.next_listing_code() to authenticated, service_role;

create function private.guard_listings() returns trigger
language plpgsql set search_path = '' as $$
declare
  old_status public.listing_status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
begin
  -- code: system-assigned, immutable
  if tg_op = 'UPDATE' and old.code is not null and new.code is distinct from old.code then
    raise exception 'listing code is permanent (%)', old.code using errcode = '42501';
  end if;
  if new.code is not null and (tg_op = 'INSERT' or old.code is null) and not private.is_trusted() then
    raise exception 'listing code is assigned automatically on first publish' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.unit_id := old.unit_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  -- status transitions for non-admin staff (admins, rpc and server may do anything)
  if new.status is distinct from old_status and not (private.is_trusted() or private.is_admin()) then
    if tg_op = 'INSERT' and new.status <> 'draft' then
      raise exception 'new listings start as draft; use submit_listing' using errcode = '42501';
    end if;
    if not (
      -- moving between public states, or hiding, once published
      (private.is_public_status(old_status) and (private.is_public_status(new.status) or new.status = 'hidden'))
      -- withdrawing a submission / un-hiding back to draft
      or (old_status in ('pending', 'hidden') and new.status = 'draft')
      -- re-publishing a hidden listing needs publishing rights
      or (old_status = 'hidden' and private.is_public_status(new.status) and private.can_publish())
    ) then
      raise exception 'status change % → % needs approval (use submit_listing)', old_status, new.status using errcode = '42501';
    end if;
  end if;

  -- entering a public state
  if private.is_public_status(new.status) then
    if not private.listing_is_complete(new) then
      raise exception 'listing is missing required fields' using errcode = '23514';
    end if;
    if new.code is null then
      new.code := private.next_listing_code();
    end if;
    new.published_at := coalesce(new.published_at, now());
    if not private.is_public_status(old_status) then
      new.verified_at := coalesce(new.verified_at, now());
      new.rejection_reason := null;
    end if;
  end if;

  -- translation timestamps
  if tg_op = 'INSERT' or new.desc_vi is distinct from old.desc_vi then
    new.desc_vi_updated_at := case when new.desc_vi is null then null else now() end; end if;
  if tg_op = 'INSERT' or new.desc_en is distinct from old.desc_en then
    new.desc_en_updated_at := case when new.desc_en is null then null else now() end; end if;
  if tg_op = 'INSERT' or new.desc_ru is distinct from old.desc_ru then
    new.desc_ru_updated_at := case when new.desc_ru is null then null else now() end; end if;

  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger guard before insert or update on public.listings for each row execute function private.guard_listings();

-- ───────────────────────── photos ─────────────────────────
create function private.guard_photos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    new.listing_id := old.listing_id; new.building_id := old.building_id; new.unit_id := old.unit_id;
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.photos for each row execute function private.guard_photos();

-- ───────────────────────── leads ─────────────────────────
create function private.guard_leads() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.assigned_to := auth.uid();
  elsif new.assigned_to is distinct from old.assigned_to then
    raise exception 'only admins can reassign' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.leads for each row execute function private.guard_leads();

-- ───────────────────────── consign inbox ─────────────────────────
create function private.guard_consign() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.is_trusted() or private.is_admin() then return new; end if;
  if new.assigned_to is distinct from old.assigned_to or new.status is distinct from old.status
     or new.unit_id is distinct from old.unit_id or new.listing_id is distinct from old.listing_id then
    raise exception 'only admins can assign or reject consign requests' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before update on public.consign_inbox for each row execute function private.guard_consign();
