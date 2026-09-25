-- ApartQN · 5/5 · storage buckets + policies
-- Paths:  listing-public   listings/<listing_id>/<file>, buildings/<slug>/<file>
--         listing-internal listings/<listing_id>/<file>, units/<unit_id>/<file>
--         consign-inbox    <upload_id>/<file>   (signed upload URLs issued by the server)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-public', 'listing-public', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('listing-internal', 'listing-internal', false, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('consign-inbox', 'consign-inbox', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;
grant execute on function private.try_uuid(text) to anon, authenticated, service_role;

-- Can the current user write this object path?
create function private.can_write_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.is_admin() then p_bucket in ('listing-public', 'listing-internal')
    when p_bucket in ('listing-public', 'listing-internal') and split_part(p_name, '/', 1) = 'listings'
      then private.owns_listing(private.try_uuid(split_part(p_name, '/', 2)))
    when p_bucket = 'listing-internal' and split_part(p_name, '/', 1) = 'units'
      then private.owns_unit(private.try_uuid(split_part(p_name, '/', 2)))
    else false
  end
$$;

-- Can the current user read this object (private buckets)?
create function private.can_read_object(p_bucket text, p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.is_admin() then true
    when p_bucket = 'consign-inbox' then exists (
      select 1 from public.consign_inbox c
       where c.assigned_to = auth.uid() and c.status = 'assigned' and p_name = any (c.photo_paths))
      and private.is_staff()
    else private.can_write_object(p_bucket, p_name)
  end
$$;
grant execute on function private.can_write_object(text, text), private.can_read_object(text, text)
  to anon, authenticated, service_role;

create policy aqn_staff_read on storage.objects for select to authenticated
  using (bucket_id in ('listing-public', 'listing-internal', 'consign-inbox') and private.can_read_object(bucket_id, name));
create policy aqn_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-public', 'listing-internal') and private.can_write_object(bucket_id, name));
create policy aqn_staff_update on storage.objects for update to authenticated
  using (bucket_id in ('listing-public', 'listing-internal') and private.can_write_object(bucket_id, name))
  with check (bucket_id in ('listing-public', 'listing-internal') and private.can_write_object(bucket_id, name));
create policy aqn_staff_delete on storage.objects for delete to authenticated
  using (bucket_id in ('listing-public', 'listing-internal', 'consign-inbox')
         and (private.is_admin() or private.can_write_object(bucket_id, name)));
-- No anon policies: public files are served by the public bucket URL; consign uploads use signed URLs.
