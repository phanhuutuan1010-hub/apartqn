-- ApartQN · 14 · building fee model, listing fee inheritance, 4 new buildings
-- Building fees (VND). null = not known yet — never guessed. Values from a fee table of unknown date are
-- fee_verified = false; values read from a management-office invoice are fee_verified = true. No personal
-- data from invoices is stored (only rates).
-- Listings keep their concrete monthly columns (mgmt / moto / car) as the EFFECTIVE values: computed from the
-- building (lib/fees.ts) unless the field is in fee_overrides. mgmt_fee_paid_by: who pays the management fee.

alter table public.buildings
  add column mgmt_fee_per_m2 int check (mgmt_fee_per_m2 between 0 and 1000000),
  add column mgmt_fee_vat_pct numeric(4, 1) check (mgmt_fee_vat_pct between 0 and 100),
  add column motorbike_fee int check (motorbike_fee between 0 and 10000000),
  add column motorbike_fee_from_3rd int check (motorbike_fee_from_3rd between 0 and 10000000),
  add column car_fee int check (car_fee between 0 and 100000000),
  add column car_parking text check (car_parking in ('paid', 'free', 'none')),
  add column bicycle_fee int check (bicycle_fee between 0 and 10000000),
  add column electricity_rate int check (electricity_rate between 0 and 100000),
  add column electricity_vat_pct numeric(4, 1) check (electricity_vat_pct between 0 and 100),
  add column water_rate int check (water_rate between 0 and 1000000),
  add column water_vat_pct numeric(4, 1) check (water_vat_pct between 0 and 100),
  add column water_extra_note text check (length(water_extra_note) <= 300),
  add column fee_source text check (length(fee_source) <= 300),
  add column fee_updated_on date,
  add column fee_verified boolean not null default false;

alter table public.listings
  add column fee_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(fee_overrides) = 'object' and fee_overrides - array['mgmt', 'moto', 'car'] = '{}'::jsonb),
  add column mgmt_fee_paid_by text not null default 'tenant' check (mgmt_fee_paid_by in ('tenant', 'owner'));

-- ── seed (by slug; "bảng phí" = table of unknown date, VAT unknown)
update public.buildings b set mgmt_fee_per_m2 = v.mgmt, motorbike_fee = v.moto, car_fee = v.car, car_parking = v.park,
  fee_source = 'Bảng phí (chưa rõ ngày)', fee_verified = false
from (values
  ('altara', 12100, 60000, 900000, 'paid'),
  ('phutai', 9900, 60000, 700000, 'paid'),
  ('thinhphat', 8000, 60000, 900000, 'paid'),
  ('ecolife', 5500, 55000, 600000, 'paid'),
  ('hagl', 5000, 60000, 400000, 'paid'),
  ('apt', 5000, 40000, 400000, 'paid')
) as v(slug, mgmt, moto, car, park)
where b.slug = v.slug;

update public.buildings set
  mgmt_fee_per_m2 = 16500, mgmt_fee_vat_pct = 10,
  motorbike_fee = 60000, motorbike_fee_from_3rd = 100000,
  car_fee = 900000, car_parking = 'paid', bicycle_fee = 40000,
  electricity_rate = 3449, electricity_vat_pct = 8,
  water_rate = 28864, water_vat_pct = 5, water_extra_note = '+ phí bảo vệ môi trường 10%',
  fee_source = 'Hoá đơn BQL 08/2026 (xe đạp 40.000 ₫, 60.000 ₫ từ xe thứ 3)', fee_updated_on = '2026-08-01', fee_verified = true
where slug = 'flc';

update public.buildings set
  mgmt_fee_per_m2 = 11500, mgmt_fee_vat_pct = 10,
  electricity_rate = 3363, electricity_vat_pct = 8,
  water_rate = 17100, water_vat_pct = 5, water_extra_note = '+ phí thoát nước / xử lý nước thải',
  fee_source = 'Hoá đơn BQL 04/2026', fee_updated_on = '2026-04-01', fee_verified = true
where slug = 'tms';

-- new buildings: no address / ward / coordinates yet, no listings
insert into public.buildings (slug, name, street, code_prefix, sort, is_demo, mgmt_fee_per_m2, motorbike_fee, car_parking, fee_source, fee_verified)
values
  ('simona', 'Simona', '', 'SIM', 20, false, 8600, 60000, 'none', 'Bảng phí (chưa rõ ngày)', false),
  ('xuanthuy', 'Xuân Thủy', '', 'XTH', 21, false, 7800, 40000, 'none', 'Bảng phí (chưa rõ ngày)', false),
  ('lamer', 'Lamer', '', 'LMR', 22, false, 7200, 60000, 'free', 'Bảng phí (chưa rõ ngày) · ô tô đỗ đường nội bộ, miễn phí', false),
  ('longthinh', 'Long Thịnh', '', 'LTH', 23, false, 5000, 60000, 'none', 'Bảng phí (chưa rõ ngày)', false)
on conflict (slug) do nothing;

-- ── existing listings take the building fees (same formula as lib/fees.ts; nothing overridden yet)
alter table public.listings disable trigger stamp;
update public.listings l set
  mgmt = case when b.mgmt_fee_per_m2 is not null and l.area is not null
              then round(l.area * b.mgmt_fee_per_m2 * (1 + coalesce(b.mgmt_fee_vat_pct, 0) / 100))::bigint else l.mgmt end,
  moto = coalesce(b.motorbike_fee, l.moto),
  car = case b.car_parking when 'paid' then coalesce(b.car_fee, l.car) when 'free' then 0 when 'none' then 0 else l.car end,
  car_parking = case b.car_parking when 'none' then false when 'paid' then true when 'free' then true else l.car_parking end
from public.units u join public.buildings b on b.id = u.building_id
where u.id = l.unit_id;
alter table public.listings enable trigger stamp;

-- ── public views: + fee fields the site shows (no fee_source), + mgmt_fee_paid_by
create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  b.aliases, b.code_prefix,
  b.mgmt_fee_per_m2, b.mgmt_fee_vat_pct, b.motorbike_fee, b.motorbike_fee_from_3rd, b.car_fee, b.car_parking, b.bicycle_fee,
  b.electricity_rate, b.electricity_vat_pct, b.water_rate, b.water_vat_pct, b.water_extra_note, b.fee_updated_on, b.fee_verified
from public.buildings b;

create or replace view public.public_listings with (security_barrier = true) as
select
  l.code, b.slug as building_slug, u.floor,
  l.area, l.beds, l.baths, l.dir, l.view, l.furn, l.rent, l.deposit, l.cycle, l.mgmt, l.elec, l.water,
  l.moto, l.car, l.net, l.min_term, l.max_occ, l.pets, l.temp_reg, l.car_parking, l.verified, l.video,
  l.status, l.move_in, l.updated_at, l.placeholder_photos, l.is_demo,
  l.desc_vi, l.desc_en, l.desc_ru,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.listing_id = l.id and p.visibility = 'public'), '[]'::jsonb) as photos,
  l.verified_at, l.published_at, l.video_url, l.legacy_code, l.mgmt_fee_paid_by
from public.listings l
join public.units u on u.id = l.unit_id
join public.buildings b on b.id = u.building_id
where l.code is not null and l.status in ('available', 'reserved', 'rented');

revoke all on public.public_buildings, public.public_listings from anon, authenticated;
grant select on public.public_buildings, public.public_listings to anon, authenticated, service_role;
