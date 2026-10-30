-- ApartQN · 42 · Russian as a site language + structured fields for generated descriptions. Additive only: no column
-- dropped, old text kept (furniture_note / view_note / desc_* stay; they are copied, never deleted).
--
-- unit_types.furniture (full | basic | none), unit_types.views[] (sea | city | mountain | lake | river), features[]
--   widened (washer, full_kitchen, …; the old keys stay valid). Old free-text notes → structured values where a phrase
--   is recognised; any note text → desc_custom_vi (so nothing written by staff is lost).
-- buildings.amenities widened (elevator, car_parking, motorbike_parking, reception, …); old keys mapped, still valid.
-- desc_custom_{vi,en,ru} on unit_types and buildings: an optional override of the generated description of that
--   language. Existing descriptions (desc_vi / desc_en / desc_ru) are copied in as overrides.
-- Locale 'ru' allowed on contact_clicks and search_intents.

-- ───────────── unit types ─────────────
alter table public.unit_types
  add column furniture text check (furniture in ('full', 'basic', 'none')),
  add column views text[] not null default '{}' check (views <@ array['sea', 'city', 'mountain', 'lake', 'river']),
  add column desc_custom_vi text check (length(desc_custom_vi) <= 5000),
  add column desc_custom_en text check (length(desc_custom_en) <= 5000),
  add column desc_custom_ru text check (length(desc_custom_ru) <= 5000);

alter table public.unit_types drop constraint unit_types_features_check;
alter table public.unit_types add constraint unit_types_features_check check (features <@ array[
  -- current
  'washer', 'dryer', 'full_kitchen', 'dishwasher', 'oven', 'balcony', 'bathtub', 'workspace', 'air_con', 'wifi', 'smart_tv', 'pets_ok',
  -- before migration 42 (still accepted; mapped below)
  'sea_view', 'city_view', 'river_view', 'lagoon_view', 'kitchen', 'furnished']);

alter table public.unit_types disable trigger stamp;
update public.unit_types t set
  views = (select coalesce(array_agg(distinct v), '{}') from unnest(array[
            case when 'sea_view' = any (t.features) or t.view_note ~* '(biển|bien|sea|море)' then 'sea' end,
            case when 'city_view' = any (t.features) or t.view_note ~* '(thành phố|thanh pho|city|город)' then 'city' end,
            case when 'river_view' = any (t.features) or t.view_note ~* '(sông|song|river|река)' then 'river' end,
            case when 'lagoon_view' = any (t.features) or t.view_note ~* '(đầm|dam|hồ|lake|lagoon|озер|лагун)' then 'lake' end,
            case when t.view_note ~* '(núi|nui|mountain|гор)' then 'mountain' end]) v where v is not null),
  furniture = coalesce(t.furniture, case
            when 'furnished' = any (t.features) or t.furniture_note ~* '(đầy đủ|day du|full|fully)' then 'full'
            when t.furniture_note ~* '(cơ bản|co ban|basic)' then 'basic'
            when t.furniture_note ~* '(không nội thất|khong noi that|trống|unfurnished|none)' then 'none' end),
  features = array(select case f when 'kitchen' then 'full_kitchen' else f end from unnest(t.features) f
                   where f not in ('sea_view', 'city_view', 'river_view', 'lagoon_view', 'furnished')),
  desc_custom_vi = coalesce(t.desc_custom_vi, nullif(concat_ws(E'\n\n', t.desc_vi, t.furniture_note, t.view_note), '')),
  desc_custom_en = coalesce(t.desc_custom_en, t.desc_en),
  desc_custom_ru = coalesce(t.desc_custom_ru, t.desc_ru);
alter table public.unit_types enable trigger stamp;

-- ───────────── buildings ─────────────
alter table public.buildings drop constraint buildings_amenities_check;
alter table public.buildings add constraint buildings_amenities_check check (amenities <@ array[
  'pool', 'gym', 'security', 'elevator', 'car_parking', 'motorbike_parking', 'reception', 'minimart', 'playground', 'garden',
  'bbq', 'sauna', 'laundry', 'coworking',
  -- before migration 42 (still accepted; mapped below)
  'lift', 'basement', 'mart', 'kids']);
alter table public.buildings
  add column desc_custom_vi text check (length(desc_custom_vi) <= 8000),
  add column desc_custom_en text check (length(desc_custom_en) <= 8000),
  add column desc_custom_ru text check (length(desc_custom_ru) <= 8000);

alter table public.buildings disable trigger stamp;
update public.buildings b set
  amenities = (select coalesce(array_agg(distinct a order by a), '{}') from unnest(
                 array(select case x when 'lift' then 'elevator' when 'basement' then 'motorbike_parking' when 'mart' then 'minimart'
                                     when 'kids' then 'playground' else x end from unnest(b.amenities) x)
                 || case when b.car_parking in ('paid', 'free') then array['car_parking'] else '{}'::text[] end) a),
  desc_custom_vi = coalesce(b.desc_custom_vi, b.desc_vi),
  desc_custom_en = coalesce(b.desc_custom_en, b.desc_en),
  desc_custom_ru = coalesce(b.desc_custom_ru, b.desc_ru);
alter table public.buildings enable trigger stamp;

-- ───────────── public views: new columns appended ─────────────
create or replace view public.public_buildings with (security_barrier = true) as
select
  b.slug, b.name, b.street, b.ward_new, b.ward_old, b.lat, b.lng, b.amenities,
  b.desc_vi, b.desc_en, b.desc_ru, b.sort, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.building_id = b.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
  b.aliases, b.code_prefix,
  b.mgmt_fee_per_m2, b.mgmt_fee_vat_pct, b.motorbike_fee, b.motorbike_fee_from_3rd, b.car_fee, b.car_parking, b.bicycle_fee,
  b.electricity_rate, b.electricity_vat_pct, b.water_rate, b.water_vat_pct, b.water_extra_note, b.fee_updated_on, b.fee_verified,
  b.maps_url, b.video_url,
  b.desc_custom_vi, b.desc_custom_en, b.desc_custom_ru
from public.buildings b
where b.deleted_at is null and b.is_visible;

create or replace view public.public_unit_types with (security_barrier = true) as
select
  t.code, b.slug as building_slug, b.code_prefix, t.type, t.area_min, t.area_max, t.price_from, t.price_updated_at,
  t.furniture_note, t.view_note, t.features, t.desc_vi, t.desc_en, t.desc_ru, t.sort, t.updated_at, b.is_demo,
  coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'thumb', p.thumb_path, 'w', p.width, 'h', p.height, 'tag', p.tag, 'source', p.source, 'v', p.variants)
                             order by p.is_cover desc, p.sort, p.created_at)
            from public.photos p
            where p.unit_type_id = t.id and p.visibility = 'public' and p.deleted_at is null), '[]'::jsonb) as photos,
  t.furniture, t.views, t.desc_custom_vi, t.desc_custom_en, t.desc_custom_ru
from public.unit_types t
join public.buildings b on b.id = t.building_id
where t.is_visible and t.deleted_at is null and b.deleted_at is null and b.is_visible;

create or replace view public.admin_unit_types with (security_invoker = true) as
select
  t.id, t.building_id, t.type, t.code, t.area_min, t.area_max, t.price_from, t.price_updated_at, t.furniture_note, t.view_note,
  t.features, t.desc_vi is not null and btrim(t.desc_vi) <> '' as has_vi, t.is_visible, t.sort, t.updated_at, t.updated_by, t.created_at,
  b.name as building_name, b.slug as building_slug, b.code_prefix, b.sort as building_sort, b.is_visible as building_visible, b.is_demo as building_demo,
  (select count(*) from public.photos p where p.unit_type_id = t.id and p.deleted_at is null)::int as photo_count,
  (select p.thumb_path from public.photos p where p.unit_type_id = t.id and p.deleted_at is null order by p.is_cover desc, p.sort limit 1) as cover_thumb,
  private.en_status(t.desc_vi, t.desc_en, t.desc_en_vi_hash) as en_status,
  t.furniture, t.views
from public.unit_types t
join public.buildings b on b.id = t.building_id
where t.deleted_at is null and b.deleted_at is null;

-- ───────────── Russian visitors in the anonymous logs ─────────────
alter table public.contact_clicks drop constraint contact_clicks_locale_check;
alter table public.contact_clicks add constraint contact_clicks_locale_check check (locale in ('vi', 'en', 'ru'));
alter table public.search_intents drop constraint search_intents_locale_check;
alter table public.search_intents add constraint search_intents_locale_check check (locale is null or locale in ('vi', 'en', 'ru'));
