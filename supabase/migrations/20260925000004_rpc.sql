-- ApartQN · 4/5 · RPC (SECURITY DEFINER). Every function checks the caller itself.
-- `app.rpc = on` (transaction-local) lets the guard triggers accept the status changes made here.

-- Submit a draft: publishers → available (code assigned now), others → pending approval.
create function public.submit_listing(p_listing uuid)
returns table (code text, status public.listing_status)
language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  if not (private.is_admin() or private.owns_listing(p_listing)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;
  if l.status not in ('draft', 'pending', 'hidden') then
    raise exception 'listing is already published (%)', l.status using errcode = '22023';
  end if;
  if not private.listing_is_complete(l) then
    raise exception 'listing is missing required fields' using errcode = '23514';
  end if;
  perform set_config('app.rpc', 'on', true);
  if private.can_publish() then
    update public.listings set status = 'available', submitted_at = now() where id = p_listing;
  else
    update public.listings set status = 'pending', submitted_at = now(), rejection_reason = null where id = p_listing;
  end if;
  perform set_config('app.rpc', 'off', true);
  return query select x.code, x.status from public.listings x where x.id = p_listing;
end $$;

create function public.approve_listing(p_listing uuid)
returns table (code text, status public.listing_status)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.listings set status = 'available' where id = p_listing and listings.status = 'pending';
  if not found then raise exception 'listing is not pending' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'off', true);
  return query select x.code, x.status from public.listings x where x.id = p_listing;
end $$;

create function public.reject_listing(p_listing uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.listings set status = 'draft', rejection_reason = trim(p_reason)
   where id = p_listing and status = 'pending';
  if not found then raise exception 'listing is not pending' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'off', true);
end $$;

-- Duplicate check across ALL units (even ones the caller cannot see): exists + assignee name + date only.
create function public.check_duplicate(p_building uuid, p_floor int, p_unit_no text)
returns table (is_duplicate boolean, assignee_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select true, coalesce(nullif(p.full_name, ''), p.email, '—'), u.created_at
      from public.units u left join public.profiles p on p.id = u.assigned_to
     where u.building_id = p_building and u.floor = p_floor
       and u.unit_key = lower(regexp_replace(p_unit_no, '[^0-9A-Za-z]', '', 'g'))
     limit 1;
  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
end $$;

-- Move everything assigned to one person to another (staff leaving / handover). Admin only.
create function public.reassign_all(p_from uuid, p_to uuid)
returns table (units int, leads int, consign int)
language plpgsql security definer set search_path = '' as $$
declare n_units int; n_leads int; n_consign int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'same user' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_to and active) then
    raise exception 'target user is not an active staff member' using errcode = '22023';
  end if;
  update public.units set assigned_to = p_to where assigned_to = p_from;
  get diagnostics n_units = row_count;
  update public.leads set assigned_to = p_to where assigned_to = p_from and status not in ('won', 'lost');
  get diagnostics n_leads = row_count;
  update public.consign_inbox set assigned_to = p_to where assigned_to = p_from;
  get diagnostics n_consign = row_count;
  return query select n_units, n_leads, n_consign;
end $$;

-- Names of staff for display ("Sửa lần cuối bởi X", assignee columns). No contact data.
create function public.staff_directory()
returns table (id uuid, full_name text, email text, role public.user_role, active boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, case when private.is_admin() then p.email else null end, p.role, p.active
    from public.profiles p
   where private.is_staff()
   order by p.full_name
$$;

-- Lock down: Postgres grants EXECUTE to PUBLIC by default.
revoke all on function public.submit_listing(uuid), public.approve_listing(uuid), public.reject_listing(uuid, text),
  public.check_duplicate(uuid, int, text), public.reassign_all(uuid, uuid), public.staff_directory()
  from public, anon;
grant execute on function public.submit_listing(uuid), public.approve_listing(uuid), public.reject_listing(uuid, text),
  public.check_duplicate(uuid, int, text), public.reassign_all(uuid, uuid), public.staff_directory()
  to authenticated, service_role;
