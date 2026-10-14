-- ApartQN · 33 · "WhatsApp click": a visitor tapped "Book a viewing" on an English listing page and WhatsApp opened.
-- Not a lead (no name, no phone, nothing about the visitor): the listing code, the channel, where the visitor first came
-- from (post short-link cookie → utm), the page path and the site language. Written only through log_contact_intent();
-- staff read; the daily cron deletes rows older than 180 days.
create table public.contact_intents (
  id bigint generated always as identity primary key,
  code text not null check (code ~ '^[A-Z]{3}-[0-9]{3,6}$'),
  channel text not null check (channel in ('whatsapp')),
  utm_source text check (utm_source is null or length(utm_source) <= 40),
  utm_content text check (utm_content is null or length(utm_content) <= 80),
  page text check (page is null or length(page) <= 200),
  locale text check (locale is null or locale in ('vi', 'en')),
  created_at timestamptz not null default now()
);
create index contact_intents_code_idx on public.contact_intents (code, created_at);
create index contact_intents_created_idx on public.contact_intents (created_at);
alter table public.contact_intents enable row level security;
revoke all on public.contact_intents from anon, authenticated;
grant select on public.contact_intents to authenticated;
grant all on public.contact_intents to service_role;
create policy contact_intents_staff_read on public.contact_intents for select to authenticated using ((select private.is_staff()));

-- true = stored (the caller then notifies the admins). Unknown / non-public codes, junk input and floods are dropped.
create function public.log_contact_intent(p_code text, p_channel text, p_source text, p_content text, p_page text, p_locale text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_intents where created_at > now() - interval '1 minute') >= 60 then return false; end if;
  if not exists (select 1 from public.listings l where l.code = upper(p_code) and l.deleted_at is null and l.status in ('available', 'reserved', 'rented')) then return false; end if;
  insert into public.contact_intents (code, channel, utm_source, utm_content, page, locale)
  values (upper(p_code), p_channel, nullif(left(p_source, 40), ''), nullif(left(p_content, 80), ''), nullif(left(p_page, 200), ''), p_locale);
  return true;
exception when check_violation or not_null_violation then
  return false;
end $$;
revoke all on function public.log_contact_intent(text, text, text, text, text, text) from public;
grant execute on function public.log_contact_intent(text, text, text, text, text, text) to anon, authenticated, service_role;
