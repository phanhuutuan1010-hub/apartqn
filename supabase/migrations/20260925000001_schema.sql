-- ApartQN · 1/5 · schema
-- Tables, enums, sequences, integrity triggers. RLS lives in 0003, RPCs in 0004, storage in 0005.

create extension if not exists pgcrypto;

create schema if not exists private;

-- ───────────────────────── enums ─────────────────────────
create type public.user_role as enum ('admin', 'sales');
create type public.listing_status as enum ('draft', 'pending', 'available', 'reserved', 'rented', 'hidden');
create type public.furnishing as enum ('full', 'basic', 'empty');
create type public.consign_status as enum ('new', 'assigned', 'rejected');
create type public.lead_status as enum ('new', 'contacted', 'viewed', 'won', 'lost');
create type public.photo_visibility as enum ('public', 'internal');

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  telegram_chat_id text,
  role public.user_role not null default 'sales',
  can_publish boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.profiles is 'Staff accounts (invite-only). One row per auth.users row.';

-- ───────────────────────── settings (single row) ─────────────────────────
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  last_backup_at timestamptz,
  verify_remind_days int not null default 14 check (verify_remind_days between 1 and 365),
  verify_hide_days int not null default 21 check (verify_hide_days between 1 and 365),
  backup_warn_days int not null default 7 check (backup_warn_days between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (verify_hide_days > verify_remind_days)
);
insert into public.settings (id) values (1);

-- ───────────────────────── buildings ─────────────────────────
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) > 0),
  street text not null default '',
  ward_new text,           -- after the 2025 ward merger
  ward_old text,           -- before the merger
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  -- building defaults used to prefill new listings: { mgmt_per_m2, moto, car, net } in VND
  default_fees jsonb not null default '{}'::jsonb check (jsonb_typeof(default_fees) = 'object'),
  amenities text[] not null default '{}'
    check (amenities <@ array['pool', 'gym', 'security', 'lift', 'basement', 'mart', 'kids']),
  desc_vi text, desc_en text, desc_ru text,
  sort int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check ((lat is null) = (lng is null))
);

-- ───────────────────────── units (INTERNAL) ─────────────────────────
create table public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete restrict,
  floor int not null check (floor between -5 and 120),
  unit_no text not null check (length(trim(unit_no)) > 0),
  -- normalized for duplicate detection: "12.05" / "12-05" / "1205 " → "1205"
  unit_key text generated always as (lower(regexp_replace(unit_no, '[^0-9A-Za-z]', '', 'g'))) stored,
  owner_name text,
  owner_phone text,
  owner_notes text,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (building_id, floor, unit_key)
);
create index units_assigned_to_idx on public.units (assigned_to);

-- ───────────────────────── listings ─────────────────────────
create sequence public.listing_code_seq as int start 1 minvalue 1;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references public.units (id) on delete restrict,
  code text unique check (code ~ '^QN-[0-9]{3,}$'),  -- assigned on FIRST publish, never changes
  status public.listing_status not null default 'draft',
  area numeric(6, 1) check (area > 0 and area < 1000),
  beds int check (beds between 0 and 10),
  baths int check (baths between 0 and 10),
  dir text check (dir in ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')),
  view text check (view in ('sea', 'city', 'river', 'lagoon')),
  furn public.furnishing,
  rent bigint check (rent > 0),
  deposit int check (deposit between 0 and 12),        -- months
  cycle text check (cycle in ('m1', 'm3')),
  mgmt bigint check (mgmt >= 0),
  elec text check (elec in ('evn', 'fixed')),
  water text check (water in ('meter', 'person')),
  moto bigint check (moto >= 0),
  car bigint check (car >= 0),
  net bigint check (net >= 0),                          -- 0 = included
  min_term int check (min_term between 1 and 120),
  max_occ int check (max_occ between 1 and 20),
  pets boolean not null default false,
  temp_reg boolean not null default true,
  car_parking boolean,                                  -- no data yet
  verified boolean not null default false,              -- "Đã xác minh" badge (checked on site)
  verified_at timestamptz,                              -- last "còn trống" confirmation
  video boolean not null default false,
  move_in date,
  placeholder_photos int not null default 0 check (placeholder_photos between 0 and 50), -- demo only
  desc_vi text, desc_en text, desc_ru text,
  desc_vi_updated_at timestamptz, desc_en_updated_at timestamptz, desc_ru_updated_at timestamptz,
  rejection_reason text,
  submitted_at timestamptz,
  published_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index listings_status_idx on public.listings (status);

-- Fields that must be filled before a listing can leave draft
create function private.listing_is_complete(l public.listings) returns boolean
language sql immutable as $$
  select l.area is not null and l.beds is not null and l.baths is not null and l.furn is not null
     and l.rent is not null and l.deposit is not null and l.cycle is not null and l.mgmt is not null
     and l.elec is not null and l.water is not null and l.moto is not null and l.car is not null
     and l.net is not null and l.min_term is not null and l.max_occ is not null and l.move_in is not null
     and l.dir is not null and l.view is not null
$$;

-- ───────────────────────── photos ─────────────────────────
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete cascade,
  building_id uuid references public.buildings (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  bucket text not null check (bucket in ('listing-public', 'listing-internal')),
  path text not null,
  thumb_path text,
  sort int not null default 0,
  is_cover boolean not null default false,
  visibility public.photo_visibility not null default 'public',
  width int, height int,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, building_id, unit_id) = 1),
  check ((visibility = 'public') = (bucket = 'listing-public')),
  check (unit_id is null or visibility = 'internal'),   -- unit photos are never public
  unique (bucket, path)
);
create index photos_listing_idx on public.photos (listing_id, sort);
create index photos_building_idx on public.photos (building_id, sort);
create index photos_unit_idx on public.photos (unit_id, sort);
-- at most one cover per owner
create unique index photos_one_cover_listing on public.photos (listing_id) where is_cover and listing_id is not null;
create unique index photos_one_cover_building on public.photos (building_id) where is_cover and building_id is not null;

-- ───────────────────────── consign inbox ─────────────────────────
create table public.consign_inbox (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings (id) on delete set null,
  building_text text,
  floor text, area text, beds text,
  rent text not null,
  owner_name text not null,
  owner_phone text not null,
  locale text not null default 'vi' check (locale in ('vi', 'en', 'ru')),
  page text,
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 10),
  status public.consign_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz,
  unit_id uuid references public.units (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index consign_status_idx on public.consign_inbox (status, created_at desc);

-- ───────────────────────── leads ─────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  name text not null,
  phone text not null,
  channel text not null default 'web' check (channel in ('web', 'phone', 'zalo', 'telegram', 'whatsapp', 'walk_in', 'other')),
  locale text check (locale in ('vi', 'en', 'ru')),
  message text,
  preferred_date date,
  duration_months text,
  page text,
  status public.lead_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index leads_assigned_idx on public.leads (assigned_to, status);
create index leads_status_idx on public.leads (status, created_at desc);
