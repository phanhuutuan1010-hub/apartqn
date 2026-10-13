-- ApartQN · 30 · post generator v2: short link clicks + lead attribution
-- post_clicks: one anonymous row per click on /c/{code} (no IP, no user agent, no id) — listing code, where the post was
-- (fb | zalo), which post form (img | link | comment), which language pair. Written only through log_post_click();
-- staff read; the daily cron deletes rows older than 180 days.
-- leads.utm_*: first-touch attribution copied from the visitor's 30-day cookie when a form is sent.
create table public.post_clicks (
  id bigint generated always as identity primary key,
  code text not null check (code ~ '^[A-Z]{3}-[0-9]{3,6}$'),
  source text not null check (source in ('fb', 'zalo')),
  variant text not null check (variant in ('img', 'link', 'comment')),
  lang_pair text not null check (lang_pair in ('vi-en', 'ru-en')),
  created_at timestamptz not null default now()
);
create index post_clicks_code_idx on public.post_clicks (code, created_at);
create index post_clicks_created_idx on public.post_clicks (created_at);
alter table public.post_clicks enable row level security;
revoke all on public.post_clicks from anon, authenticated;
grant select on public.post_clicks to authenticated;
grant all on public.post_clicks to service_role;
create policy post_clicks_staff_read on public.post_clicks for select to authenticated using ((select private.is_staff()));

create function public.log_post_click(p_code text, p_source text, p_variant text, p_pair text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- crude flood guard: counts only need to be roughly right
  if (select count(*) from public.post_clicks where created_at > now() - interval '1 minute') >= 300 then return; end if;
  insert into public.post_clicks (code, source, variant, lang_pair) values (upper(p_code), p_source, p_variant, p_pair);
exception when check_violation or not_null_violation then
  null; -- junk input is dropped silently
end $$;
revoke all on function public.log_post_click(text, text, text, text) from public;
grant execute on function public.log_post_click(text, text, text, text) to anon, authenticated, service_role;

alter table public.leads
  add column utm_source text check (utm_source is null or length(utm_source) <= 40),
  add column utm_medium text check (utm_medium is null or length(utm_medium) <= 40),
  add column utm_campaign text check (utm_campaign is null or length(utm_campaign) <= 40),
  add column utm_content text check (utm_content is null or length(utm_content) <= 80);
