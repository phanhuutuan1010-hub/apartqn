-- ApartQN · 8 · fix: creating users failed ("Database error saving new user")
-- GoTrue inserts into auth.users on its own connection (session_user = supabase_auth_admin, no JWT claims).
-- handle_new_user is SECURITY DEFINER, which changes current_user but NOT session_user, so
-- private.is_trusted() was false and guard_profiles rejected the insert ("profiles are created by invite only").
-- The trigger now marks itself trusted for exactly its own insert, then clears the flag.
-- Invite-only is unchanged: API callers still cannot insert profiles, and public sign-up is disabled in Auth settings.

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.rpc', 'on', true);
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  perform set_config('app.rpc', '', true);
  return new;
end $$;
