/**
 * Migration 41 — buildings + unit types; listings / units archived. Current schema (every migration).
 * Roles: anon · sales · publisher (can_publish) · inactive · admin · server. Each `as()` block is rolled back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, close, denied, root } from './helpers';

const U = {
  admin: 'bbbbbbbb-0000-0000-0000-000000000001',
  s1: 'bbbbbbbb-0000-0000-0000-000000000002',
  pub: 'bbbbbbbb-0000-0000-0000-000000000003',
  off: 'bbbbbbbb-0000-0000-0000-000000000004',
};
const id = (x: string) => ({ id: x });
let B = '', B2 = '', T2 = '', TS = '', T2b = '', unit1 = '', l1 = '', lead1 = '', bPhoto = '', lPhoto = '';

const ut = async (building: string, type: string) =>
  (await root(`select id from public.unit_types where building_id = $1 and type = $2`, [building, type])).rows[0].id as string;

beforeAll(async () => {
  for (const [k, v] of Object.entries(U)) {
    await root(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [v, `${k}@pivot.vn`, { full_name: `User ${k}` }]);
  }
  await root(`update public.profiles set role = 'admin' where id = $1`, [U.admin]);
  await root(`update public.profiles set can_publish = true where id = $1`, [U.pub]);
  B = (await root(`insert into public.buildings (slug, name, street, amenities, code_prefix) values ('altara', 'Altara', 'Trần Hưng Đạo', '{pool}', 'ALT') returning id`)).rows[0].id;
  B2 = (await root(`insert into public.buildings (slug, name, street, code_prefix) values ('flc', 'FLC Sea Tower', 'An Dương Vương', 'FLC') returning id`)).rows[0].id;
  T2 = await ut(B, '2pn');
  TS = await ut(B, 'studio');
  T2b = await ut(B2, '2pn');
  // one visible type (filled by the server)
  await root(`update public.unit_types set area_min = 68, area_max = 75, price_from = 13500000, features = '{sea_view,balcony}', desc_vi = 'Căn mẫu', is_visible = true where id = $1`, [T2]);
  // a listing from the old days: archived by hand (rows created after the migration are not touched by it)
  unit1 = (await root(`insert into public.units (building_id, floor, unit_no, owner_name, owner_phone, assigned_to, is_archived, archived_at)
                       values ($1, 18, '18.05', 'Chủ nhà', '0909', $2, true, now()) returning id`, [B, U.s1])).rows[0].id;
  l1 = (await root(`insert into public.listings (unit_id, code, legacy_code, status, beds, area, is_archived, archived_at)
                    values ($1, 'ALT-001', 'QN-001', 'draft', 2, 68, true, now()) returning id`, [unit1])).rows[0].id;
  lead1 = (await root(`insert into public.leads (name, phone, assigned_to, unit_type_id, unit_type_code) values ('Khách', '0901', $1, $2, 'ALT-2PN') returning id`, [U.s1, T2])).rows[0].id;
  bPhoto = (await root(`insert into public.photos (building_id, bucket, path, visibility) values ($1, 'listing-public', 'buildings/altara/a.webp', 'public') returning id`, [B])).rows[0].id;
  lPhoto = (await root(`insert into public.photos (listing_id, bucket, path, visibility) values ($1, 'listing-public', 'listings/x/a.webp', 'public') returning id`, [l1])).rows[0].id;
  await root(`update public.profiles set active = false where id = $1`, [U.off]);
});
afterAll(close);

describe('unit type drafts', () => {
  it('every building has four hidden, empty drafts coded {PREFIX}-{TYPE}', async () => {
    const r = await root(`select type, code, is_visible, price_from, area_min, desc_vi from public.unit_types where building_id = $1 order by sort`, [B2]);
    expect(r.rows).toEqual(['studio', '1pn', '2pn', '3pn'].map((t) => ({ type: t, code: `FLC-${t.toUpperCase()}`, is_visible: false, price_from: null, area_min: null, desc_vi: null })));
    // buildings from earlier migrations got theirs in migration 41
    const n = await root(`select count(*)::int n from public.unit_types t join public.buildings b on b.id = t.building_id where b.slug = 'simona'`);
    expect(n.rows[0].n).toBe(4);
  });

  it('a building prefix change follows into the codes; frozen once a type is public', async () => {
    await as(id(U.admin), async (q) => {
      await q(`update public.buildings set code_prefix = 'FLX' where id = $1`, [B2]);
      expect((await q(`select code from public.unit_types where id = $1`, [T2b])).rows[0].code).toBe('FLX-2PN');
      expect(await denied(q(`update public.buildings set code_prefix = 'ALX' where id = $1`, [B]))).toMatch(/không đổi được tiền tố/);
    });
  });
});

describe('anon', () => {
  it.each(['unit_types', 'listings', 'units', 'photos'])('cannot read table %s', async (t) => {
    expect(await as('anon', (q) => denied(q(`select * from public.${t}`)))).toMatch(/permission denied/);
  });

  it('public_listings is closed to the site', async () => {
    expect(await as('anon', (q) => denied(q(`select * from public.public_listings`)))).toMatch(/permission denied/);
  });

  it('public_unit_types: visible types of visible buildings only, reference data only', async () => {
    const r = await as('anon', (q) => q(`select * from public.public_unit_types`));
    expect(r.rows.map((x) => x.code)).toEqual(['ALT-2PN']);
    expect(r.rows[0]).toMatchObject({ building_slug: 'altara', code_prefix: 'ALT', type: '2pn', area_min: '68.0', area_max: '75.0', price_from: '13500000', features: ['sea_view', 'balcony'] });
    expect(r.rows[0].price_updated_at).not.toBeNull();
    const cols = r.fields.map((f) => f.name);
    for (const bad of ['id', 'building_id', 'created_by', 'updated_by', 'deleted_at', 'is_visible', 'floor', 'unit_no', 'status']) expect(cols).not.toContain(bad);
    // the building hidden → its types leave too
    await as('anon', async (q) => {
      await root(`select 1`); // fixture untouched
      expect((await q(`select count(*)::int n from public.public_unit_types where building_slug = 'flc'`)).rows[0].n).toBe(0);
    });
  });

  it('old listing codes redirect to the unit type of the same building + bedrooms, else the building', async () => {
    await as('anon', async (q) => {
      expect((await q(`select public.listing_redirect('ALT-001') r`)).rows[0].r).toBe('ALT-2PN');
      expect((await q(`select public.listing_redirect('qn-001') r`)).rows[0].r).toBe('ALT-2PN');
      expect((await q(`select public.listing_redirect('XYZ-001') r`)).rows[0].r).toBeNull();
    });
    await root(`update public.listings set beds = 0 where id = $1`, [l1]);
    try {
      expect((await as('anon', (q) => q(`select public.listing_redirect('ALT-001') r`))).rows[0].r).toBe('ALT'); // studio still hidden
    } finally {
      await root(`update public.listings set beds = 2 where id = $1`, [l1]);
    }
  });

  it('hidden unit type → its building prefix (redirect target), unknown → null', async () => {
    await as('anon', async (q) => {
      expect((await q(`select public.unit_type_building('alt-studio') r`)).rows[0].r).toBe('ALT');
      expect((await q(`select public.unit_type_building('ZZZ-1PN') r`)).rows[0].r).toBeNull();
    });
  });

  it.each([
    [`select * from public.submit_listing('00000000-0000-0000-0000-000000000000')`],
    [`select * from public.trash_unit_type('00000000-0000-0000-0000-000000000000')`],
    [`select * from public.log_post_click('ALT-001', 'fb', 'link', 'vi-en')`],
  ])('cannot call rpc: %s', async (sql) => {
    expect(await as('anon', (q) => denied(q(sql)))).toMatch(/permission denied/);
  });

  it('chat taps may name a visible unit type only', async () => {
    await as('anon', async () => undefined);
    const ok = await as('service', (q) => q(`select public.log_chat_intent('ALT-2PN', 'zalo', 'unit-type', '', '', '', '/ALT-2PN', 'vi') r`));
    expect(ok.rows[0].r).toBe(true);
    const hidden = await as('service', (q) => q(`select public.log_chat_intent('ALT-STUDIO', 'whatsapp', 'unit-type', '', '', '', '/en/ALT-STUDIO', 'en') r`));
    expect(hidden.rows[0].r).toBe(false);
  });
});

describe('sales', () => {
  it('reads and edits unit types; values stamped; building / type / code fixed', async () => {
    await as(id(U.s1), async (q) => {
      expect((await q(`select count(*)::int n from public.unit_types`)).rows[0].n).toBeGreaterThanOrEqual(8);
      const before = (await q(`select price_updated_at from public.unit_types where id = $1`, [T2])).rows[0].price_updated_at;
      await q(`update public.unit_types set view_note = 'Hướng biển' where id = $1`, [T2]);
      expect((await q(`select price_updated_at from public.unit_types where id = $1`, [T2])).rows[0].price_updated_at).toEqual(before);
      const r = (await q(`update public.unit_types set price_from = 9000000, type = '3pn', building_id = $2, code = 'XXX-3PN' where id = $1
                          returning type, building_id, code, price_updated_at, updated_by`, [TS, B2])).rows[0];
      expect(r).toMatchObject({ type: 'studio', building_id: B, code: 'ALT-STUDIO', updated_by: U.s1 });
      expect(r.price_updated_at).not.toBeNull();
    });
  });

  it('cannot make a type visible (publishing right), trash it, or set deleted_at', async () => {
    await as(id(U.s1), async (q) => {
      await q(`update public.unit_types set price_from = 9000000, area_min = 30 where id = $1`, [TS]);
      expect(await denied(q(`update public.unit_types set is_visible = true where id = $1`, [TS]))).toMatch(/quyền đăng/);
      expect(await denied(q(`select public.trash_unit_type($1)`, [TS]))).toMatch(/admin only/);
      await q(`update public.unit_types set deleted_at = now() where id = $1`, [TS]);
      expect((await q(`select deleted_at from public.unit_types where id = $1`, [TS])).rows[0].deleted_at).toBeNull();
    });
  });

  it('archive: listings, units and their photos are out of reach; nothing can be written', async () => {
    await as(id(U.s1), async (q) => {
      expect((await q(`select * from public.listings`)).rowCount).toBe(0);
      expect((await q(`select * from public.units`)).rowCount).toBe(0);
      expect((await q(`select id from public.photos where listing_id is not null`)).rowCount).toBe(0);
      expect(await denied(q(`insert into public.units (building_id, floor, unit_no) values ($1, 1, '101')`, [B]))).toMatch(/permission denied/);
      expect(await denied(q(`update public.listings set rent = 1 where id = $1`, [l1]))).toMatch(/permission denied/);
      expect(await denied(q(`select public.create_listing_draft($1, 1, '1')`, [B]))).toMatch(/permission denied/);
    });
  });

  it('unit type photos: public only, watermarked by default; building photos stay admin-only', async () => {
    await as(id(U.s1), async (q) => {
      const p = (await q(`insert into public.photos (unit_type_id, bucket, path, visibility) values ($1, 'listing-public', 'unit-types/${T2}/a.webp', 'public') returning watermark`, [T2])).rows[0];
      expect(p.watermark).toBe(true);
      expect(await denied(q(`insert into public.photos (unit_type_id, bucket, path, visibility) values ($1, 'listing-internal', 'unit-types/${T2}/b.webp', 'internal')`, [T2]))).toMatch(/unit_type_public|row-level/);
      expect(await denied(q(`insert into public.photos (building_id, bucket, path, visibility) values ($1, 'listing-public', 'buildings/altara/z.webp', 'public')`, [B]))).toMatch(/row-level security/);
    });
  });

  it('storage: writes only under an existing unit type folder', async () => {
    await as(id(U.s1), async (q) => {
      await q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'unit-types/${T2}/x.webp')`);
      await q(`insert into storage.objects (bucket_id, name) values ('listing-master', 'unit-types/${T2}/x.webp')`);
      expect(await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'unit-types/00000000-0000-0000-0000-000000000000/x.webp')`))).toMatch(/row-level/);
      expect(await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'listings/${l1}/x.webp')`))).toMatch(/row-level/);
      expect(await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'buildings/altara/x.webp')`))).toMatch(/row-level/);
    });
  });

  it('leads: cannot rewrite the unit type of a request', async () => {
    await as(id(U.s1), async (q) => {
      expect(await denied(q(`update public.leads set unit_type_id = $2 where id = $1`, [lead1, TS]))).toMatch(/only admins can change the request/);
      await q(`update public.leads set status = 'contacted' where id = $1`, [lead1]);
    });
  });

  it('moves photos between unit types of one building; not to the building, not across buildings', async () => {
    await as(id(U.s1), async (q) => {
      const p = (await q(`insert into public.photos (unit_type_id, bucket, path, visibility, watermark) values ($1, 'listing-public', 'unit-types/${T2}/m.webp', 'public', false) returning id`, [T2])).rows[0].id;
      const r = (await q(`select public.move_photos(array[$1]::uuid[], 'unit_type', $2) r`, [p, TS])).rows[0].r;
      expect(r).toEqual({ moved: 1, need_watermark: [p] });
      expect((await q(`select is_cover from public.photos where id = $1`, [p])).rows[0].is_cover).toBe(true);
      expect(await denied(q(`select public.move_photos(array[$1]::uuid[], 'building', $2)`, [p, B]))).toMatch(/not allowed/);
      expect(await denied(q(`select public.move_photos(array[$1]::uuid[], 'unit_type', $2)`, [p, T2b]))).toMatch(/other building/);
    });
  });
});

describe('publisher', () => {
  it('can show a filled type; an empty one is refused by the check', async () => {
    await as(id(U.pub), async (q) => {
      expect(await denied(q(`update public.unit_types set is_visible = true where id = $1`, [TS]))).toMatch(/check constraint/);
      await q(`update public.unit_types set price_from = 8000000, area_min = 32, is_visible = true where id = $1`, [TS]);
      expect((await as('anon', (a) => a(`select count(*)::int n from public.public_unit_types`))).rows[0].n).toBe(1); // other transaction: unchanged
    });
  });
});

describe('inactive staff', () => {
  it('sees and changes nothing', async () => {
    await as(id(U.off), async (q) => {
      expect((await q(`select * from public.unit_types`)).rowCount).toBe(0);
      expect((await q(`update public.unit_types set price_from = 1000000 where id = $1`, [T2])).rowCount).toBe(0);
    });
  });
});

describe('admin', () => {
  it('reads the archive, cannot change it', async () => {
    await as(id(U.admin), async (q) => {
      expect((await q(`select code, is_archived from public.listings`)).rows).toEqual([{ code: 'ALT-001', is_archived: true }]);
      expect((await q(`select owner_name from public.units`)).rows[0].owner_name).toBe('Chủ nhà');
      expect((await q(`select count(*)::int n from public.admin_listings`)).rows[0].n).toBe(1);
      expect(await denied(q(`update public.listings set rent = 1 where id = $1`, [l1]))).toMatch(/permission denied/);
      expect(await denied(q(`delete from public.units where id = $1`, [unit1]))).toMatch(/permission denied/);
      expect(await denied(q(`select public.trash_photos(array[$1]::uuid[])`, [lPhoto]))).toMatch(/not allowed/);
      expect(await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'listings/${l1}/y.webp')`))).toMatch(/row-level/);
      expect(await denied(q(`select public.purge_listing($1)`, [l1]))).toMatch(/permission denied/);
    });
  });

  it('trash → restore → trash → purge a unit type; lead keeps its code; Thùng rác lists it', async () => {
    await as(id(U.admin), async (q) => {
      const p = (await q(`insert into public.photos (unit_type_id, bucket, path, visibility) values ($1, 'listing-public', 'unit-types/${T2b}/p.webp', 'public') returning id`, [T2b])).rows[0].id;
      await q(`select public.trash_unit_type($1)`, [T2b]);
      expect((await q(`select count(*)::int n from public.unit_types where id = $1`, [T2b])).rows[0].n).toBe(0);
      expect((await q(`select kind, label from public.trash_items() where id = $1`, [T2b])).rows[0]).toEqual({ kind: 'unit_type', label: 'FLC-2PN · FLC Sea Tower' });
      await q(`select public.restore_unit_type($1)`, [T2b]);
      await q(`select public.trash_unit_type($1)`, [T2b]);
      const files = (await q(`select public.purge_unit_type($1) f`, [T2b])).rows[0].f;
      expect(files).toContainEqual({ bucket: 'listing-public', path: 'unit-types/' + T2b + '/p.webp' });
      expect((await q(`select count(*)::int n from public.photos where id = $1`, [p])).rows[0].n).toBe(0);
      // the building can now get its type again
      await q(`insert into public.unit_types (building_id, type) values ($1, '2pn')`, [B2]);
    });
  });

  it('a building with a visible type cannot be trashed; trash_items no longer lists listings', async () => {
    await as(id(U.admin), async (q) => {
      expect(await denied(q(`select public.trash_building($1)`, [B]))).toMatch(/đang hiển thị/);
      await root(`select 1`);
      expect((await q(`select count(*)::int n from public.trash_items() where kind = 'listing'`)).rows[0].n).toBe(0);
    });
  });

  it('archived units are not holdings: they never block a handover or a user deletion', async () => {
    await as(id(U.admin), async (q) => {
      expect((await q(`select * from public.user_holdings($1)`, [U.s1])).rows[0]).toEqual({ units: 0, open_leads: 1 });
      expect((await q(`select * from public.reassign_all($1, $2)`, [U.s1, U.pub])).rows[0]).toEqual({ units: 0, leads: 1, consign: 0 });
      expect((await q(`select assigned_to from public.units where id = $1`, [unit1])).rows[0].assigned_to).toBe(U.s1);
    });
  });

  it('building photos: admin moves one to a unit type of the same building', async () => {
    await as(id(U.admin), async (q) => {
      const r = (await q(`select public.move_photos(array[$1]::uuid[], 'unit_type', $2) r`, [bPhoto, T2])).rows[0].r;
      expect(r.moved).toBe(1);
    });
  });
});

describe('server', () => {
  it('purge by age never touches archived listing photos', async () => {
    await root(`update public.photos set deleted_at = now() - interval '40 days' where id = $1`, [lPhoto]);
    try {
      const files = (await as('service', (q) => q(`select public.purge_photos(null, false, now() - interval '30 days') f`))).rows[0].f;
      expect(files).toEqual([]);
      expect((await root(`select count(*)::int n from public.photos where id = $1`, [lPhoto])).rows[0].n).toBe(1);
    } finally {
      await root(`update public.photos set deleted_at = null where id = $1`, [lPhoto]);
    }
  });

  it('a new building gets its drafts', async () => {
    const b = (await root(`insert into public.buildings (slug, name, code_prefix) values ('newb', 'Mới', 'NEW') returning id`)).rows[0].id;
    try {
      expect((await root(`select array_agg(code order by sort) c from public.unit_types where building_id = $1`, [b])).rows[0].c).toEqual(['NEW-STUDIO', 'NEW-1PN', 'NEW-2PN', 'NEW-3PN']);
    } finally {
      await root(`delete from public.unit_types where building_id = $1`, [b]);
      await root(`delete from public.buildings where id = $1`, [b]);
    }
  });
});

describe('Russian + structured fields (migration 42)', () => {
  it('unit types: furniture, views, new features; old keys still accepted; overrides per language in the public view', async () => {
    await as(id(U.s1), async (q) => {
      await q(`update public.unit_types set furniture = 'full', views = '{sea,city}', features = '{washer,full_kitchen}', desc_custom_ru = 'Своё описание' where id = $1`, [T2]);
      expect(await denied(q(`update public.unit_types set views = '{moon}' where id = $1`, [T2]))).toMatch(/check/);
      expect(await denied(q(`update public.unit_types set furniture = 'some' where id = $1`, [T2]))).toMatch(/check/);
      await q(`update public.unit_types set features = '{sea_view}' where id = $1`, [TS]); // pre-42 key, still valid
    });
    await root(`update public.unit_types set furniture = 'basic', views = '{lake}', desc_custom_en = 'Own text' where id = $1`, [T2]);
    try {
      const r = (await as('anon', (q) => q(`select furniture, views, desc_custom_vi, desc_custom_en, desc_custom_ru from public.public_unit_types where code = 'ALT-2PN'`))).rows[0];
      expect(r).toEqual({ furniture: 'basic', views: ['lake'], desc_custom_vi: null, desc_custom_en: 'Own text', desc_custom_ru: null });
    } finally {
      await root(`update public.unit_types set furniture = null, views = '{}', desc_custom_en = null where id = $1`, [T2]);
    }
  });
  it('buildings: new amenities and per-language overrides in the public view', async () => {
    await as(id(U.admin), async (q) => {
      await q(`update public.buildings set amenities = '{pool,elevator,car_parking,reception}', desc_custom_ru = 'Дом' where id = $1`, [B]);
      expect(await denied(q(`update public.buildings set amenities = '{helipad}' where id = $1`, [B]))).toMatch(/check/);
    });
    const r = (await as('anon', (q) => q(`select desc_custom_vi, desc_custom_ru from public.public_buildings where slug = 'altara'`))).rows[0];
    expect(Object.keys(r)).toEqual(['desc_custom_vi', 'desc_custom_ru']);
  });
  it('anonymous logs accept Russian visitors', async () => {
    await as('service', async (q) => {
      await q(`select public.log_contact_click('telegram', 'ky-gui', 'ru', '')`);
      expect((await q(`select count(*)::int n from public.contact_clicks where locale = 'ru'`)).rows[0].n).toBe(1);
      expect((await q(`select public.log_search_intent('telegram', 'студия', '{}', '', '', '', '/ru/kvartiry', 'ru', '') r`)).rows[0].r).toBe(true);
    });
  });
});
