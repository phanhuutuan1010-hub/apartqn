-- ApartQN · 21 · manual-assisted EN translation
-- desc_en_vi_hash: SHA-256 of the Vietnamese text the English was written from (set when desc_en changes, or when staff
-- confirm "bản EN vẫn đúng"). en_status: na (no VI text) · none (Chưa dịch) · stale (Cần cập nhật) · ok (Đã dịch).
-- translation_glossary: vi → en terms copied into the "Sao chép để dịch" block. Additive only.

-- normalised like the browser does it: \r\n → \n, outer whitespace trimmed
create function private.vi_hash(t text) returns text
language sql immutable set search_path = '' as $$
  select case when t is null or btrim(replace(t, E'\r\n', E'\n'), E' \n\t\r') = '' then null
              else encode(pg_catalog.sha256(convert_to(btrim(replace(t, E'\r\n', E'\n'), E' \n\t\r'), 'UTF8')), 'hex') end
$$;

create function private.en_status(vi text, en text, hash text) returns text
language sql immutable set search_path = '' as $$
  select case when coalesce(btrim(vi), '') = '' then 'na'
              when coalesce(btrim(en), '') = '' then 'none'
              when hash = private.vi_hash(vi) then 'ok'
              else 'stale' end
$$;
grant execute on function private.vi_hash(text), private.en_status(text, text, text) to authenticated, service_role;

alter table public.listings add column desc_en_vi_hash text check (desc_en_vi_hash is null or desc_en_vi_hash ~ '^[0-9a-f]{64}$');
alter table public.buildings add column desc_en_vi_hash text check (desc_en_vi_hash is null or desc_en_vi_hash ~ '^[0-9a-f]{64}$');

-- saving an English text records which Vietnamese text it translates
create function private.track_en_source() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.desc_en is distinct from old.desc_en then
    new.desc_en_vi_hash := case when coalesce(btrim(new.desc_en), '') = '' then null else private.vi_hash(new.desc_vi) end;
  end if;
  return new;
end $$;
create trigger track_en_source before insert or update on public.listings for each row execute function private.track_en_source();
create trigger track_en_source before insert or update on public.buildings for each row execute function private.track_en_source();

-- existing English: listings whose EN is not older than VI count as translated; buildings have no timestamps → translated
alter table public.listings disable trigger stamp;
update public.listings set desc_en_vi_hash = private.vi_hash(desc_vi)
 where coalesce(btrim(desc_en), '') <> '' and (desc_vi_updated_at is null or desc_en_updated_at is null or desc_en_updated_at >= desc_vi_updated_at);
alter table public.listings enable trigger stamp;
update public.buildings set desc_en_vi_hash = private.vi_hash(desc_vi) where coalesce(btrim(desc_en), '') <> '';

-- admin_listings + en_status (appended)
create or replace view public.admin_listings with (security_invoker = true) as
select
  l.id, l.code, l.status, l.rent, l.beds, l.area, l.furn, l.move_in, l.verified, l.verified_at,
  l.desc_vi is not null as has_vi, l.desc_en is not null as has_en, l.desc_ru is not null as has_ru,
  (l.desc_en is not null and l.desc_vi_updated_at > l.desc_en_updated_at) as en_outdated,
  (l.desc_ru is not null and l.desc_vi_updated_at > l.desc_ru_updated_at) as ru_outdated,
  l.rejection_reason, l.submitted_at, l.published_at, l.is_demo, l.updated_at, l.updated_by, l.created_at,
  u.id as unit_id, u.floor, u.unit_no, u.assigned_to,
  b.id as building_id, b.slug as building_slug, b.name as building_name,
  (select count(*) from public.photos p where p.listing_id = l.id)::int as photo_count,
  private.en_status(l.desc_vi, l.desc_en, l.desc_en_vi_hash) as en_status
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.deleted_at is null and b.deleted_at is null;

-- glossary
create table public.translation_glossary (
  id bigint generated always as identity primary key,
  vi text not null check (length(btrim(vi)) between 1 and 80),
  en text not null check (length(btrim(en)) between 1 and 120),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create unique index translation_glossary_vi_idx on public.translation_glossary (lower(vi));
alter table public.translation_glossary enable row level security;
revoke all on public.translation_glossary from anon, authenticated;
grant select, insert, update, delete on public.translation_glossary to authenticated;
grant all on public.translation_glossary to service_role;
create policy glossary_staff_read on public.translation_glossary for select to authenticated using ((select private.is_staff()));
create policy glossary_admin_write on public.translation_glossary for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.translation_glossary (vi, en, sort) values
  ('full nội thất', 'fully furnished', 1),
  ('nội thất cơ bản', 'partly furnished', 2),
  ('diện tích thông thủy', 'net area', 3),
  ('phí quản lý', 'management fee', 4),
  ('phòng ngủ', 'bedroom', 5),
  ('view biển', 'sea view', 6),
  ('Quy Nhơn', 'Quy Nhon', 7);
