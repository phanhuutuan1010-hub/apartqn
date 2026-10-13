-- ApartQN · 26 · listing demo flag (admin only) + bulk trash / restore of listings
-- is_demo could be changed by any staff member through a plain update: only admins (and the server) may now.
-- trash_listings / restore_listings: ONE call for a batch, the same rules as trash_listing / restore_listing per row;
-- rows the caller may not delete are skipped and counted, never an error for the whole batch.
create function private.guard_listing_demo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_demo is distinct from old.is_demo and not (private.is_trusted() or private.is_admin()) then
    raise exception 'only admins change the demo flag' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_demo before update on public.listings for each row execute function private.guard_listing_demo();

create function public.trash_listings(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings; done uuid[] := '{}'; seen int := 0;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if cardinality(p_ids) > 200 then raise exception 'too many listings' using errcode = '22023'; end if;
  for l in select * from public.listings where id = any (p_ids) and deleted_at is null loop
    seen := seen + 1;
    -- admin: any; sales: an own listing that was never published
    continue when not (private.is_admin() or (private.owns_unit(l.unit_id) and l.code is null));
    perform set_config('app.rpc', 'on', true);
    update public.listings set deleted_at = now(), deleted_by = auth.uid(), status_before_delete = l.status,
           status = case when private.is_public_status(l.status) or l.status = 'pending' then 'hidden' else l.status end
     where id = l.id;
    perform set_config('app.rpc', 'off', true);
    done := done || l.id;
  end loop;
  return jsonb_build_object('trashed', to_jsonb(done), 'skipped', cardinality(p_ids) - cardinality(done));
end $$;

create function public.restore_listings(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare l public.listings; n int := 0;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  for l in select * from public.listings where id = any (p_ids) and deleted_at is not null loop
    continue when not (private.is_admin() or (l.deleted_by = auth.uid() and l.deleted_at > now() - interval '10 minutes'));
    continue when exists (select 1 from public.units u join public.buildings b on b.id = u.building_id where u.id = l.unit_id and b.deleted_at is not null);
    perform set_config('app.rpc', 'on', true);
    update public.listings set deleted_at = null, deleted_by = null, status = coalesce(l.status_before_delete, l.status), status_before_delete = null
     where id = l.id;
    perform set_config('app.rpc', 'off', true);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.trash_listings(uuid[]), public.restore_listings(uuid[]) from public, anon;
grant execute on function public.trash_listings(uuid[]), public.restore_listings(uuid[]) to authenticated, service_role;
