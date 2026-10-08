-- ApartQN · 10 · search demand
-- search_misses: anonymous log of searches that found nothing. NO IP / user agent / user id — just the
-- normalised text, the site language and what the parser understood. Written only through log_search_miss()
-- (anon may call it, nobody but admins may read). Rows older than 90 days are deleted by the daily cron.
-- leads.search: "Nhờ tìm giúp" requests keep the original query + parsed criteria.

alter table public.leads
  add column search jsonb check (search is null or (jsonb_typeof(search) = 'object' and length(search::text) <= 2000));

create table public.search_misses (
  id bigint generated always as identity primary key,
  query_norm text not null check (length(query_norm) between 2 and 80),
  locale text not null check (locale in ('vi', 'en', 'ru')),
  parsed jsonb not null default '{}'::jsonb check (jsonb_typeof(parsed) = 'object' and length(parsed::text) <= 1000),
  created_at timestamptz not null default now()
);
create index search_misses_created_idx on public.search_misses (created_at desc);

alter table public.search_misses enable row level security;
revoke all on public.search_misses from anon, authenticated;
grant select on public.search_misses to authenticated;
grant all on public.search_misses to service_role;
create policy search_misses_admin_read on public.search_misses for select to authenticated using (private.is_admin());

-- anon entry point; validates server-side, never returns data
create function public.log_search_miss(p_query text, p_locale text, p_parsed jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare q text := lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g'));
begin
  if length(q) < 2 or length(q) > 80 then raise exception 'query must be 2–80 characters' using errcode = '22023'; end if;
  if p_locale is null or p_locale not in ('vi', 'en', 'ru') then raise exception 'bad locale' using errcode = '22023'; end if;
  if p_parsed is null or jsonb_typeof(p_parsed) <> 'object' or length(p_parsed::text) > 1000 then p_parsed := '{}'::jsonb; end if;
  -- flood guard (global, no per-user data): ignore beyond 120 rows a minute
  if (select count(*) from public.search_misses where created_at > now() - interval '1 minute') >= 120 then return; end if;
  insert into public.search_misses (query_norm, locale, parsed) values (q, p_locale, p_parsed);
end $$;
revoke all on function public.log_search_miss(text, text, jsonb) from public;
grant execute on function public.log_search_miss(text, text, jsonb) to anon, authenticated, service_role;

-- admin report: top missed queries (SECURITY INVOKER → RLS: non-admins get nothing)
create function public.search_miss_top(p_days int default 30, p_limit int default 10)
returns table (query_norm text, n bigint, last_at timestamptz, locales text[])
language sql stable security invoker set search_path = '' as $$
  select m.query_norm, count(*) as n, max(m.created_at) as last_at, array_agg(distinct m.locale order by m.locale) as locales
  from public.search_misses m
  where m.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by m.query_norm
  order by n desc, last_at desc
  limit greatest(1, least(p_limit, 500))
$$;
revoke all on function public.search_miss_top(int, int) from public, anon;
grant execute on function public.search_miss_top(int, int) to authenticated, service_role;
