-- ApartQN · 36 · Marketplace: the listing's main language for its Marketplace title / description (VI · RU · EN).
-- null = not chosen yet: the kit suggests one (sea view + fully furnished → RU, otherwise VI) and shows "Gợi ý".
alter table public.listings
  add column marketplace_lang text check (marketplace_lang in ('vi', 'ru', 'en'));

-- "Ngôn ngữ chính": admin, or the listing's own sales person (same rule as set_marketplace). null clears the choice.
create function public.set_marketplace_lang(p_id uuid, p_lang text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.listings where id = p_id) then raise exception 'listing not found' using errcode = '22023'; end if;
  if not (private.is_admin() or private.is_trusted() or private.owns_listing(p_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_lang is not null and p_lang not in ('vi', 'ru', 'en') then raise exception 'bad lang' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.listings set marketplace_lang = p_lang where id = p_id;
end $$;
revoke all on function public.set_marketplace_lang(uuid, text) from public, anon;
grant execute on function public.set_marketplace_lang(uuid, text) to authenticated, service_role;
