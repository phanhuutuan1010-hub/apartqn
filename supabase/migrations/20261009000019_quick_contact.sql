-- ApartQN · 19 · consign page quick contact
-- settings: Zalo number (falls back to the hotline), contact person shown on /ky-gui (name, title, photo in listing-public).
-- public_contact: the only settings fields the public site may read. contact_clicks: anonymous click counts (no IP, no id),
-- written only through log_contact_click(), read by admins, deleted after 90 days by the daily cron.
alter table public.settings
  add column zalo_phone text check (zalo_phone is null or zalo_phone ~ '^[0-9+() .-]{6,24}$'),
  add column contact_person_name text check (contact_person_name is null or length(contact_person_name) between 1 and 60),
  add column contact_person_title text check (contact_person_title is null or length(contact_person_title) between 1 and 80),
  add column contact_person_photo text check (contact_person_photo is null or contact_person_photo ~ '^site/[A-Za-z0-9._-]{1,80}\.webp$');

create view public.public_contact with (security_barrier = true) as
select s.hotline, s.zalo_phone, s.contact_person_name, s.contact_person_title, s.contact_person_photo
from public.settings s where s.id = 1;
revoke all on public.public_contact from anon, authenticated;
grant select on public.public_contact to anon, authenticated, service_role;

create table public.contact_clicks (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('call', 'zalo', 'whatsapp', 'copy', 'form', 'callback')),
  page text not null check (page ~ '^[a-z0-9-]{1,40}$'),
  locale text not null check (locale in ('vi', 'en')),
  created_at timestamptz not null default now()
);
create index contact_clicks_created_idx on public.contact_clicks (created_at);
alter table public.contact_clicks enable row level security;
revoke all on public.contact_clicks from anon, authenticated;
grant select on public.contact_clicks to authenticated;
grant all on public.contact_clicks to service_role;
create policy contact_clicks_admin_read on public.contact_clicks for select to authenticated using ((select private.is_admin()));

create function public.log_contact_click(p_channel text, p_page text, p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- crude flood guard: anonymous counts only need to be roughly right
  if (select count(*) from public.contact_clicks where created_at > now() - interval '1 minute') >= 120 then return; end if;
  insert into public.contact_clicks (channel, page, locale) values (p_channel, p_page, p_locale);
exception when check_violation or not_null_violation then
  null; -- junk input is dropped silently
end $$;
revoke all on function public.log_contact_click(text, text, text) from public;
grant execute on function public.log_contact_click(text, text, text) to anon, authenticated;
