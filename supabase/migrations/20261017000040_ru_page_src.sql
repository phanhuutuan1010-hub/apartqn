-- ApartQN · 40 · Russian landing page (/ru) + "src" tracking. Add-only / widening only (no data changed).
-- · public_contact also exposes the "from" prices (settings.price_from_*, migration 38) for /ru.
-- · contact_intents: Telegram as well as WhatsApp, no listing code needed (a page-level button), language 'ru',
--   origin (which button: 'ru-page', 'listing' …) and src (?src=… cookie, 30 days).
-- · src also on contact_clicks, search_intents and leads.
create or replace view public.public_contact with (security_barrier = true) as
select s.hotline, s.zalo_phone, s.contact_person_name, s.contact_person_title, s.contact_person_photo,
       s.whatsapp_phone, s.telegram_phone, s.telegram_username,
       s.price_from_studio, s.price_from_1br, s.price_from_2br
from public.settings s where s.id = 1;

alter table public.contact_intents alter column code drop not null;
alter table public.contact_intents drop constraint contact_intents_channel_check;
alter table public.contact_intents add constraint contact_intents_channel_check check (channel in ('whatsapp', 'telegram'));
alter table public.contact_intents drop constraint contact_intents_locale_check;
alter table public.contact_intents add constraint contact_intents_locale_check check (locale is null or locale in ('vi', 'en', 'ru'));
alter table public.contact_intents
  add column origin text check (origin is null or origin ~ '^[a-z0-9-]{1,40}$'),
  add column src text check (src is null or src ~ '^[A-Za-z0-9_.-]{1,40}$');

alter table public.contact_clicks add column src text check (src is null or src ~ '^[A-Za-z0-9_.-]{1,40}$');
alter table public.search_intents add column src text check (src is null or src ~ '^[A-Za-z0-9_.-]{1,40}$');
alter table public.leads add column src text check (src is null or src ~ '^[A-Za-z0-9_.-]{1,40}$');

-- chat button tap (WhatsApp / Telegram). A given code must be a public listing; no code = a page-level button.
create function public.log_chat_intent(p_code text, p_channel text, p_origin text, p_src text, p_source text, p_content text, p_page text, p_locale text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_intents where created_at > now() - interval '1 minute') >= 60 then return false; end if;
  if nullif(p_code, '') is not null and not exists (select 1 from public.listings l where l.code = upper(p_code) and l.deleted_at is null and l.status in ('available', 'reserved', 'rented')) then return false; end if;
  insert into public.contact_intents (code, channel, origin, src, utm_source, utm_content, page, locale)
  values (upper(nullif(p_code, '')), p_channel, nullif(p_origin, ''), nullif(p_src, ''), nullif(left(p_source, 40), ''), nullif(left(p_content, 80), ''), nullif(left(p_page, 200), ''), p_locale);
  return true;
exception when check_violation or not_null_violation then
  return false;
end $$;
revoke all on function public.log_chat_intent(text, text, text, text, text, text, text, text) from public;
grant execute on function public.log_chat_intent(text, text, text, text, text, text, text, text) to service_role;

create function public.log_search_intent(p_channel text, p_query text, p_criteria jsonb, p_line text, p_source text, p_content text, p_page text, p_locale text, p_src text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.search_intents where created_at > now() - interval '1 minute') >= 60 then return false; end if;
  insert into public.search_intents (channel, query, criteria, line, utm_source, utm_content, page, locale, src)
  values (p_channel, nullif(left(p_query, 80), ''), coalesce(p_criteria, '{}'::jsonb), nullif(left(p_line, 300), ''),
    nullif(left(p_source, 40), ''), nullif(left(p_content, 80), ''), nullif(left(p_page, 200), ''), p_locale, nullif(p_src, ''));
  return true;
exception when check_violation or not_null_violation then
  return false;
end $$;
revoke all on function public.log_search_intent(text, text, jsonb, text, text, text, text, text, text) from public;
grant execute on function public.log_search_intent(text, text, jsonb, text, text, text, text, text, text) to service_role;

create function public.log_contact_click(p_channel text, p_page text, p_locale text, p_src text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_clicks where created_at > now() - interval '1 minute') >= 120 then return; end if;
  insert into public.contact_clicks (channel, page, locale, src) values (p_channel, p_page, p_locale, nullif(p_src, ''));
exception when check_violation or not_null_violation then
  null;
end $$;
revoke all on function public.log_contact_click(text, text, text, text) from public;
grant execute on function public.log_contact_click(text, text, text, text) to anon, authenticated, service_role;
