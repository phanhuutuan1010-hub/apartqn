-- ApartQN · 22 · settings is the single source of every public contact number
-- settings: WhatsApp / Telegram numbers + optional Telegram username (t.me/<username>, else t.me/+84…).
-- public_contact exposes them to the site; contact clicks may be 'telegram'. Sets the real numbers (replaces the demo ones in code).
alter table public.settings
  add column whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^[0-9+() .-]{6,24}$'),
  add column telegram_phone text check (telegram_phone is null or telegram_phone ~ '^[0-9+() .-]{6,24}$'),
  add column telegram_username text check (telegram_username is null or telegram_username ~ '^[A-Za-z0-9_]{5,32}$');

-- new columns go last: create or replace keeps the existing grants
create or replace view public.public_contact with (security_barrier = true) as
select s.hotline, s.zalo_phone, s.contact_person_name, s.contact_person_title, s.contact_person_photo,
       s.whatsapp_phone, s.telegram_phone, s.telegram_username
from public.settings s where s.id = 1;

alter table public.contact_clicks drop constraint contact_clicks_channel_check;
alter table public.contact_clicks add constraint contact_clicks_channel_check
  check (channel in ('call', 'zalo', 'whatsapp', 'telegram', 'copy', 'form', 'callback'));

update public.settings
set hotline = '0363480154', zalo_phone = '0906051010', whatsapp_phone = '0906051010', telegram_phone = '0906051010', telegram_username = null
where id = 1;
