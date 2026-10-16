-- ApartQN · 37 · "Nhờ tìm giúp (nhắn tin)": on a results page with no match a visitor tapped Zalo / WhatsApp / Telegram
-- (the search already typed in, or copied for Zalo / Telegram). Not a lead (no name, no phone, nothing about the visitor):
-- the search text, the parsed criteria, a ready-made Vietnamese line for staff, the channel, the first-touch source
-- (post short-link cookie → utm), the page path and the site language. Written only through log_search_intent();
-- staff read; the daily cron deletes rows older than 180 days.
create table public.search_intents (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('zalo', 'whatsapp', 'telegram')),
  query text check (query is null or length(query) <= 80),
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object' and length(criteria::text) <= 1000),
  line text check (line is null or length(line) <= 300),
  utm_source text check (utm_source is null or length(utm_source) <= 40),
  utm_content text check (utm_content is null or length(utm_content) <= 80),
  page text check (page is null or length(page) <= 200),
  locale text check (locale is null or locale in ('vi', 'en')),
  created_at timestamptz not null default now()
);
create index search_intents_created_idx on public.search_intents (created_at);
alter table public.search_intents enable row level security;
revoke all on public.search_intents from anon, authenticated;
grant select on public.search_intents to authenticated;
grant all on public.search_intents to service_role;
create policy search_intents_staff_read on public.search_intents for select to authenticated using ((select private.is_staff()));

-- true = stored (the caller then notifies the admins). Junk input and floods are dropped.
create function public.log_search_intent(p_channel text, p_query text, p_criteria jsonb, p_line text, p_source text, p_content text, p_page text, p_locale text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.search_intents where created_at > now() - interval '1 minute') >= 60 then return false; end if;
  insert into public.search_intents (channel, query, criteria, line, utm_source, utm_content, page, locale)
  values (p_channel, nullif(left(p_query, 80), ''), coalesce(p_criteria, '{}'::jsonb), nullif(left(p_line, 300), ''),
    nullif(left(p_source, 40), ''), nullif(left(p_content, 80), ''), nullif(left(p_page, 200), ''), p_locale);
  return true;
exception when check_violation or not_null_violation then
  return false;
end $$;
revoke all on function public.log_search_intent(text, text, jsonb, text, text, text, text, text) from public;
grant execute on function public.log_search_intent(text, text, jsonb, text, text, text, text, text) to service_role;
