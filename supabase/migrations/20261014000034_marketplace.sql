-- ApartQN · 34 · Facebook Marketplace kit (posting stays manual: nothing here talks to Facebook)
-- listings.marketplace_*: whether the listing is on Marketplace now, the post's URL, when it was posted / last renewed.
-- settings.marketplace_renew_days: remind to renew after this many days. post_clicks: a third source, 'mkp'.
alter table public.listings
  add column marketplace_posted boolean not null default false,
  add column marketplace_url text check (marketplace_url is null or (marketplace_url ~ '^https://' and length(marketplace_url) <= 500)),
  add column marketplace_posted_at timestamptz,
  add column marketplace_renewed_at timestamptz;
create index listings_marketplace_idx on public.listings (marketplace_posted) where marketplace_posted;

alter table public.settings
  add column marketplace_renew_days int not null default 7 check (marketplace_renew_days between 1 and 90);

alter table public.post_clicks drop constraint post_clicks_source_check;
alter table public.post_clicks add constraint post_clicks_source_check check (source in ('fb', 'zalo', 'mkp'));

-- "Đánh dấu đã đăng" (posted, optional URL) · "Đã làm mới" (renewed) · "Đã gỡ" (removed). Admin, or the listing's own
-- sales person — also for a listing that has since been rented, hidden or moved to the trash (that is when it must come down).
create function public.set_marketplace(p_id uuid, p_action text, p_url text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := nullif(trim(coalesce(p_url, '')), '');
begin
  if not exists (select 1 from public.listings where id = p_id) then raise exception 'listing not found' using errcode = '22023'; end if;
  if not (private.is_admin() or private.is_trusted() or private.owns_listing(p_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if u is not null and (u !~ '^https://' or length(u) > 500) then raise exception 'bad url' using errcode = '22023'; end if;
  perform set_config('app.rpc', 'on', true);
  if p_action = 'posted' then
    update public.listings set marketplace_posted = true, marketplace_url = u, marketplace_posted_at = now(), marketplace_renewed_at = null where id = p_id;
  elsif p_action = 'renewed' then
    update public.listings set marketplace_renewed_at = now() where id = p_id and marketplace_posted;
  elsif p_action = 'removed' then
    update public.listings set marketplace_posted = false, marketplace_url = null where id = p_id;
  else raise exception 'bad action' using errcode = '22023';
  end if;
end $$;
revoke all on function public.set_marketplace(uuid, text, text) from public, anon;
grant execute on function public.set_marketplace(uuid, text, text) to authenticated, service_role;

-- "Hôm nay": listings still marked as posted that must come down (rented / hidden / unpublished / in the trash → 'remove')
-- or are due for a renewal ('renew': posted or last renewed more than settings.marketplace_renew_days ago).
-- Admins see all, sales their own — including trashed ones, which the table policy hides from them.
create function public.marketplace_reminders() returns table (id uuid, code text, kind text, url text, days int)
language sql stable security definer set search_path = '' as $$
  select l.id, l.code,
         case when l.deleted_at is not null or l.status not in ('available', 'reserved') then 'remove' else 'renew' end as kind,
         l.marketplace_url,
         floor(extract(epoch from now() - coalesce(l.marketplace_renewed_at, l.marketplace_posted_at, now())) / 86400)::int as days
    from public.listings l
   where l.marketplace_posted
     and (private.is_admin() or private.owns_listing(l.id))
     and (l.deleted_at is not null or l.status not in ('available', 'reserved')
          or coalesce(l.marketplace_renewed_at, l.marketplace_posted_at, now()) < now() - make_interval(days => (select s.marketplace_renew_days from public.settings s where s.id = 1)))
   order by 3, 5 desc
   limit 50
$$;
revoke all on function public.marketplace_reminders() from public, anon;
grant execute on function public.marketplace_reminders() to authenticated, service_role;
