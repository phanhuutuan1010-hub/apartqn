-- ApartQN · 18 · photos.source: unknown until an admin sets it (no "Ảnh thực tế" claim nobody has checked).
-- Migration 17 defaulted every existing photo to 'own' minutes before the admin selector shipped, so no row was set by a
-- person yet: reset them to null. null = no badge on the site.
alter table public.photos alter column source drop not null, alter column source drop default;
update public.photos set source = null where source = 'own';

create or replace function private.photos_watermark_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.watermark is null then new.watermark := new.listing_id is not null and new.source is distinct from 'reference'; end if;
  return new;
end $$;
