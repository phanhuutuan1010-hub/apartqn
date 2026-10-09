/**
 * RLS / RPC / trigger tests per role: anon · sales (assignee / non-assignee) · publisher · inactive · admin.
 * Each `as()` block runs in its own transaction and is rolled back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, close, denied, root } from './helpers';

const U = {
  admin: 'aaaaaaaa-0000-0000-0000-000000000001',
  s1: 'aaaaaaaa-0000-0000-0000-000000000002', // sales, assignee of unit1
  s2: 'aaaaaaaa-0000-0000-0000-000000000003', // sales, assignee of unit2
  pub: 'aaaaaaaa-0000-0000-0000-000000000004', // sales with can_publish
  off: 'aaaaaaaa-0000-0000-0000-000000000005', // deactivated sales, assignee of unit3
};
const id = (x: string) => ({ id: x });
let B = '', unit1 = '', unit2 = '', unit3 = '', unitP = '';
let l1 = '', l2 = '', l3 = '', lP = '', code1 = '';
let lead1 = '', lead2 = '', consign1 = '';

const COMPLETE = `area=68, beds=2, baths=2, dir='SE', view='sea', furn='full', rent=13500000, deposit=2, cycle='m1',
  mgmt=816000, elec='evn', water='meter', moto=150000, car=1500000, net=220000, min_term=6, max_occ=4, move_in='2026-10-05'`;

beforeAll(async () => {
  for (const [k, v] of Object.entries(U)) {
    await root(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [v, `${k}@test.vn`, { full_name: `User ${k}` }]);
  }
  await root(`update public.profiles set role='admin' where id=$1`, [U.admin]);
  await root(`update public.profiles set can_publish=true where id=$1`, [U.pub]);
  B = (await root(`insert into public.buildings (slug, name, street, amenities) values ('altara','Altara Residences Quy Nhơn','Trần Hưng Đạo','{pool,gym}') returning id`)).rows[0].id;
  const unit = async (floor: number, no: string, who: string) =>
    (await root(`insert into public.units (building_id, floor, unit_no, owner_name, owner_phone, owner_notes, assigned_to)
                 values ($1,$2,$3,'Chủ nhà','0909111222','ghi chú riêng',$4) returning id`, [B, floor, no, who])).rows[0].id;
  unit1 = await unit(18, '18.05', U.s1);
  unit2 = await unit(12, '12-05', U.s2);
  unit3 = await unit(9, '0901', U.off);
  unitP = await unit(22, '2201', U.pub);
  const listing = async (u: string) =>
    (await root(`insert into public.listings (unit_id, status, verified) select $1, 'draft', true returning id`, [u])).rows[0].id as string;
  l1 = await listing(unit1);
  l2 = await listing(unit2);
  l3 = await listing(unit3);
  lP = await listing(unitP);
  await root(`update public.listings set ${COMPLETE} where id = any($1)`, [[l1, l2, l3, lP]]);
  code1 = (await root(`update public.listings set status='available' where id=$1 returning code`, [l1])).rows[0].code;
  lead1 = (await root(`insert into public.leads (listing_id, name, phone, assigned_to) values ($1,'Khách A','0901',$2) returning id`, [l1, U.s1])).rows[0].id;
  lead2 = (await root(`insert into public.leads (listing_id, name, phone, assigned_to) values ($1,'Khách B','0902',$2) returning id`, [l2, U.s2])).rows[0].id;
  consign1 = (await root(`insert into public.consign_inbox (building_id, rent, owner_name, owner_phone, photo_paths)
                          values ($1,'10.000.000','Chủ ký gửi','0911','{up1/1.jpg}') returning id`, [B])).rows[0].id;
  await root(`update public.profiles set active=false where id=$1`, [U.off]);
});
afterAll(close);

describe('fixtures', () => {
  it('assigns a per-building code on first publish', () => expect(code1).toBe('ALT-001'));
});

describe('anon', () => {
  it.each(['units', 'listings', 'leads', 'profiles', 'consign_inbox', 'photos', 'settings', 'buildings'])(
    'cannot read table %s', async (t) => {
      const msg = await as('anon', (q) => denied(q(`select * from public.${t}`)));
      expect(msg).toMatch(/permission denied/);
    });

  it('reads public_listings: published only, no unit/owner columns', async () => {
    const r = await as('anon', (q) => q(`select * from public.public_listings`));
    expect(r.rows.map((x) => x.code)).toEqual([code1]);
    const cols = r.fields.map((f) => f.name);
    for (const bad of ['unit_id', 'unit_no', 'owner_name', 'owner_phone', 'owner_notes', 'assigned_to', 'created_by', 'updated_by', 'id', 'rejection_reason'])
      expect(cols).not.toContain(bad);
    expect(r.rows[0]).toMatchObject({ building_slug: 'altara', floor: 18, rent: '13500000' });
  });

  it('cannot write through the public views', async () => {
    const msg = await as('anon', (q) => denied(q(`update public.public_buildings set name='x'`)));
    expect(msg).toMatch(/permission denied/);
  });

  it('public views carry the search fields (aliases, verified_at, published_at)', async () => {
    const b = await as('anon', (q) => q(`select aliases from public.public_buildings`));
    expect(b.rows[0].aliases).toEqual([]);
    const l = await as('anon', (q) => q(`select verified_at, published_at from public.public_listings`));
    expect(l.fields.map((f) => f.name)).toEqual(['verified_at', 'published_at']);
  });

  it('reads public_buildings', async () => {
    const r = await as('anon', (q) => q(`select slug, name from public.public_buildings order by slug`));
    expect(r.rows).toContainEqual({ slug: 'altara', name: 'Altara Residences Quy Nhơn' });
    // migration 14 adds 4 real buildings (no address yet)
    expect(r.rows.map((x) => x.slug)).toEqual(expect.arrayContaining(['simona', 'xuanthuy', 'lamer', 'longthinh']));
  });

  it.each([
    [`select * from public.submit_listing('${'00000000-0000-0000-0000-000000000000'}')`],
    [`select * from public.check_duplicate('${'00000000-0000-0000-0000-000000000000'}', 1, '1')`],
    [`select * from public.staff_directory()`],
  ])('cannot call rpc: %s', async (sql) => {
    expect(await as('anon', (q) => denied(q(sql)))).toMatch(/permission denied/);
  });

  it('cannot write storage', async () => {
    const msg = await as('anon', (q) => denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'listings/${l1}/x.webp')`)));
    expect(msg).toMatch(/row-level security/);
  });
});

describe('sales (assignee scope)', () => {
  it('sees own unit with owner fields, not others', async () => {
    const r = await as(id(U.s1), (q) => q(`select id, owner_phone from public.units`));
    expect(r.rows).toEqual([{ id: unit1, owner_phone: '0909111222' }]);
  });

  it('sees only listings of own units', async () => {
    const r = await as(id(U.s1), (q) => q(`select id from public.listings`));
    expect(r.rows.map((x) => x.id)).toEqual([l1]);
  });

  it('cannot update another sales unit or listing (0 rows)', async () => {
    const r = await as(id(U.s1), async (q) => [
      (await q(`update public.units set owner_notes='x' where id=$1`, [unit2])).rowCount,
      (await q(`update public.listings set rent=1 where id=$1`, [l2])).rowCount,
    ]);
    expect(r).toEqual([0, 0]);
  });

  it('cannot change assigned_to', async () => {
    const msg = await as(id(U.s1), (q) => denied(q(`update public.units set assigned_to=$1 where id=$2`, [U.s2, unit1])));
    expect(msg).toMatch(/only admins can reassign/);
  });

  it('new units are forced onto the creator', async () => {
    const r = await as(id(U.s1), (q) => q(
      `insert into public.units (building_id, floor, unit_no, assigned_to) values ($1, 5, '0501', $2) returning assigned_to, created_by`, [B, U.s2]));
    expect(r.rows[0]).toEqual({ assigned_to: U.s1, created_by: U.s1 });
  });

  it('cannot insert a listing that is not draft', async () => {
    const msg = await as(id(U.s1), async (q) => {
      const u = (await q(`insert into public.units (building_id, floor, unit_no) values ($1, 6, '0601') returning id`, [B])).rows[0].id;
      return denied(q(`insert into public.listings (unit_id, status) values ($1, 'available')`, [u]));
    });
    expect(msg).toMatch(/start as draft/);
  });

  it('cannot publish by direct update', async () => {
    const msg = await as(id(U.s2), (q) => denied(q(`update public.listings set status='available' where id=$1`, [l2])));
    expect(msg).toMatch(/needs approval/);
  });

  it('cannot set a listing code', async () => {
    const msg = await as(id(U.s2), (q) => denied(q(`update public.listings set code='ALT-999' where id=$1`, [l2])));
    expect(msg).toMatch(/assigned automatically/);
  });

  it('submit_listing without can_publish → pending, no code', async () => {
    const r = await as(id(U.s2), (q) => q(`select * from public.submit_listing($1)`, [l2]));
    expect(r.rows[0]).toEqual({ code: null, status: 'pending' });
  });

  it('submit_listing on someone else\'s listing is refused', async () => {
    expect(await as(id(U.s1), (q) => denied(q(`select * from public.submit_listing($1)`, [l2])))).toMatch(/not allowed/);
  });

  it('can move own published listing between public states; code survives re-rent', async () => {
    const r = await as(id(U.s1), async (q) => {
      await q(`update public.listings set status='rented' where id=$1`, [l1]);
      await q(`update public.listings set status='available' where id=$1`, [l1]);
      return (await q(`select code, status from public.listings where id=$1`, [l1])).rows[0];
    });
    expect(r).toEqual({ code: code1, status: 'available' });
  });

  it('cannot delete a listing (0 rows)', async () => {
    const n = await as(id(U.s1), async (q) => (await q(`delete from public.listings where id=$1`, [l1])).rowCount);
    expect(n).toBe(0);
  });

  it('check_duplicate: sees conflict in another sales unit — name + date only', async () => {
    const r = await as(id(U.s1), (q) => q(`select * from public.check_duplicate($1, 12, '12 05')`, [B]));
    expect(r.fields.map((f) => f.name)).toEqual(['is_duplicate', 'assignee_name', 'created_at']);
    expect(r.rows[0]).toMatchObject({ is_duplicate: true, assignee_name: 'User s2' });
    const none = await as(id(U.s1), (q) => q(`select * from public.check_duplicate($1, 12, '1206')`, [B]));
    expect(none.rows[0].is_duplicate).toBe(false);
  });

  it('duplicate unit insert is rejected by the normalized unique key', async () => {
    const msg = await as(id(U.s1), (q) => denied(q(`insert into public.units (building_id, floor, unit_no) values ($1, 12, '12.05')`, [B])));
    expect(msg).toMatch(/duplicate key/);
  });

  it('leads: only own; cannot reassign', async () => {
    const r = await as(id(U.s1), async (q) => ({
      ids: (await q(`select id from public.leads`)).rows.map((x) => x.id),
      err: await denied(q(`update public.leads set assigned_to=$1 where id=$2`, [U.s2, lead1])),
    }));
    expect(r.ids).toEqual([lead1]);
    expect(r.err).toMatch(/only admins can reassign/);
  });

  it('consign leads: invisible until assigned; archive table unreadable', async () => {
    expect((await as(id(U.s1), (q) => q(`select id from public.leads where type='consign'`))).rowCount).toBe(0);
    expect((await as(id(U.s1), (q) => q(`select id from public.consign_inbox`))).rowCount).toBe(0);
  });

  it('cannot create consign leads or rewrite a lead request', async () => {
    const r = await as(id(U.s1), async (q) => [
      await denied(q(`insert into public.leads (type, name, phone) values ('consign', 'X', '0900')`)),
      await denied(q(`update public.leads set payload='{"rent":"1"}' where id=$1`, [lead1])),
      await denied(q(`update public.leads set type='consign' where id=$1`, [lead1])),
    ]);
    r.forEach((m) => expect(m).toMatch(/consign leads|change the request/));
  });

  it('cannot run admin rpc', async () => {
    const r = await as(id(U.s1), async (q) => [
      await denied(q(`select * from public.approve_listing($1)`, [l2])),
      await denied(q(`select * from public.reassign_all($1, $2)`, [U.s2, U.s1])),
    ]);
    r.forEach((m) => expect(m).toMatch(/admin only/));
  });

  it('profiles: can edit own name, not role/can_publish; cannot read others', async () => {
    const r = await as(id(U.s1), async (q) => ({
      upd: (await q(`update public.profiles set full_name='Sales Một' where id=$1`, [U.s1])).rowCount,
      role: await denied(q(`update public.profiles set can_publish=true where id=$1`, [U.s1])),
      others: (await q(`select id from public.profiles where id<>$1`, [U.s1])).rowCount,
      dir: (await q(`select email from public.staff_directory()`)).rows.every((x) => x.email === null),
    }));
    expect(r).toEqual({ upd: 1, role: expect.stringMatching(/only admins/), others: 0, dir: true });
  });

  it('storage: writes only under own listing folder', async () => {
    const r = await as(id(U.s1), async (q) => ({
      own: (await q(`insert into storage.objects (bucket_id, name) values ('listing-public', $1) returning id`, [`listings/${l1}/a.webp`])).rowCount,
      other: await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', $1)`, [`listings/${l2}/a.webp`])),
      building: await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-public', 'buildings/altara/1.webp')`)),
      internalUnit: (await q(`insert into storage.objects (bucket_id, name) values ('listing-internal', $1) returning id`, [`units/${unit1}/so-do.webp`])).rowCount,
    }));
    expect(r.own).toBe(1);
    expect(r.other).toMatch(/row-level security/);
    expect(r.building).toMatch(/row-level security/);
    expect(r.internalUnit).toBe(1);
  });
});

describe('sales with can_publish', () => {
  it('submit_listing publishes immediately with a new code', async () => {
    const r = await as(id(U.pub), (q) => q(`select * from public.submit_listing($1)`, [lP]));
    expect(r.rows[0].status).toBe('available');
    expect(r.rows[0].code).toMatch(/^ALT-\d{3}$/);
    expect(r.rows[0].code).not.toBe(code1);
  });
});

describe('inactive staff', () => {
  it('sees nothing even for own assignments', async () => {
    const r = await as(id(U.off), async (q) => [
      (await q(`select 1 from public.units`)).rowCount,
      (await q(`select 1 from public.listings`)).rowCount,
      (await q(`select 1 from public.profiles`)).rowCount,
    ]);
    expect(r).toEqual([0, 0, 0]);
  });
  it('cannot call rpc', async () => {
    expect(await as(id(U.off), (q) => denied(q(`select * from public.check_duplicate($1, 1, '1')`, [B])))).toMatch(/not allowed/);
  });
});

describe('admin', () => {
  it('sees everything', async () => {
    const r = await as(id(U.admin), async (q) => [
      (await q(`select 1 from public.units`)).rowCount,
      (await q(`select 1 from public.listings`)).rowCount,
      (await q(`select 1 from public.leads`)).rowCount,
      (await q(`select 1 from public.consign_inbox`)).rowCount,
      (await q(`select 1 from public.profiles`)).rowCount,
    ]);
    expect(r).toEqual([4, 4, 3, 1, 5]); // leads: 2 + the consign request (migration 15)
  });

  it('admin submit publishes directly', async () => {
    const r = await as(id(U.admin), (q) => q(`select * from public.submit_listing($1)`, [l3]));
    expect(r.rows[0].status).toBe('available');
  });

  it('approve / reject pending listings', async () => {
    // within one tx: sales submits, admin approves
    const approved = await as(id(U.admin), async (q) => {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      await q(`select * from public.submit_listing($1)`, [l2]);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.admin, role: 'authenticated' })]);
      return (await q(`select * from public.approve_listing($1)`, [l2])).rows[0];
    });
    expect(approved.status).toBe('available');
    expect(approved.code).toMatch(/^ALT-\d{3}$/);
    const rejected = await as(id(U.admin), async (q) => {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      await q(`select * from public.submit_listing($1)`, [l2]);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.admin, role: 'authenticated' })]);
      await q(`select public.reject_listing($1, 'Thiếu ảnh')`, [l2]);
      return (await q(`select status, code, rejection_reason from public.listings where id=$1`, [l2])).rows[0];
    });
    expect(rejected).toEqual({ status: 'draft', code: null, rejection_reason: 'Thiếu ảnh' });
  });

  it('admin can publish a complete draft by direct status change', async () => {
    const r = await as(id(U.admin), async (q) => (await q(`update public.listings set status='reserved' where id=$1 returning code`, [l3])).rows[0]);
    expect(r.code).toMatch(/^ALT-\d{3}$/);
  });

  it('code is permanent even for admin', async () => {
    const msg = await as(id(U.admin), (q) => denied(q(`update public.listings set code='ALT-777' where id=$1`, [l1])));
    expect(msg).toMatch(/permanent/);
  });

  it('cannot publish an incomplete listing', async () => {
    const msg = await as(id(U.admin), async (q) => {
      const u = (await q(`insert into public.units (building_id, floor, unit_no) values ($1, 3, '0301') returning id`, [B])).rows[0].id;
      const l = (await q(`insert into public.listings (unit_id) values ($1) returning id`, [u])).rows[0].id;
      return denied(q(`update public.listings set status='available' where id=$1`, [l]));
    });
    expect(msg).toMatch(/missing required fields/);
  });

  it('assigning a consign lead makes it (and its photos) visible to the assignee', async () => {
    const n = await as(id(U.admin), async (q) => {
      await q(`update public.leads set assigned_to=$1 where id=$2`, [U.s1, consign1]);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s1, role: 'authenticated' })]);
      const rows = (await q(`select id from public.leads where type='consign'`)).rowCount;
      const photo = (await q(`select private.can_read_object('consign-inbox', 'up1/1.jpg') as ok`)).rows[0].ok;
      const other = (await q(`select private.can_read_object('consign-inbox', 'up2/1.jpg') as ok`)).rows[0].ok;
      return [rows, photo, other];
    });
    expect(n).toEqual([1, true, false]);
  });

  it('reassign_all moves units, open leads and consign items', async () => {
    const r = await as(id(U.admin), async (q) => {
      const res = (await q(`select * from public.reassign_all($1, $2)`, [U.s1, U.s2])).rows[0];
      const owner = (await q(`select assigned_to from public.units where id=$1`, [unit1])).rows[0].assigned_to;
      return { res, owner };
    });
    expect(r.res).toEqual({ units: 1, leads: 1, consign: 0 });
    expect(r.owner).toBe(U.s2);
  });

  it('reassign_all refuses an inactive target', async () => {
    expect(await as(id(U.admin), (q) => denied(q(`select * from public.reassign_all($1, $2)`, [U.s1, U.off])))).toMatch(/not an active/);
  });

  it('can delete; last admin cannot be demoted', async () => {
    const r = await as(id(U.admin), async (q) => ({
      del: (await q(`delete from public.leads where id=$1`, [lead2])).rowCount,
      demote: await denied(q(`update public.profiles set role='sales' where id=$1`, [U.admin])),
    }));
    expect(r.del).toBe(1);
    expect(r.demote).toMatch(/last active admin/);
  });
});

describe('service role (server)', () => {
  it('bypasses RLS and may insert leads/consign', async () => {
    const r = await as('service', async (q) => [
      (await q(`insert into public.leads (name, phone) values ('Web','0903') returning id`)).rowCount,
      (await q(`select 1 from public.units`)).rowCount,
    ]);
    expect(r).toEqual([1, 4]);
  });
});

describe('admin helpers (migration 6)', () => {
  it('admin_listings: anon denied, sales sees own rows only, admin sees all', async () => {
    expect(await as('anon', (q) => denied(q(`select * from public.admin_listings`)))).toMatch(/permission denied/);
    const s1 = await as(id(U.s1), (q) => q(`select id, unit_no, building_slug from public.admin_listings`));
    expect(s1.rows).toEqual([{ id: l1, unit_no: '18.05', building_slug: 'altara' }]);
    const a = await as(id(U.admin), (q) => q(`select count(*)::int n from public.admin_listings`));
    expect(a.rows[0].n).toBe(4);
  });

  it('create_listing_draft: sales always owns the new unit; duplicates get a clear message', async () => {
    const r = await as(id(U.s1), async (q) => {
      const lid = (await q(`select public.create_listing_draft($1, 7, '07-01', $2) as id`, [B, U.s2])).rows[0].id;
      const row = (await q(`select status, assigned_to, code from public.admin_listings where id = $1`, [lid])).rows[0];
      const dup = await denied(q(`select public.create_listing_draft($1, 7, '0701')`, [B]));
      return { row, dup };
    });
    expect(r.row).toEqual({ status: 'draft', assigned_to: U.s1, code: null });
    expect(r.dup).toMatch(/đã có trong hệ thống/);
  });

  it('create_listing_draft: admin may assign to someone else; anon cannot call', async () => {
    const owner = await as(id(U.admin), async (q) => {
      const lid = (await q(`select public.create_listing_draft($1, 8, '0802', $2) as id`, [B, U.s2])).rows[0].id;
      return (await q(`select assigned_to from public.admin_listings where id = $1`, [lid])).rows[0].assigned_to;
    });
    expect(owner).toBe(U.s2);
    expect(await as('anon', (q) => denied(q(`select public.create_listing_draft($1, 9, '0903')`, [B])))).toMatch(/permission denied/);
  });
});

describe('consign leads + lead notes (migrations 7, 15)', () => {
  const newConsign = async () =>
    (await root(`insert into public.leads (type, name, phone, payload) values ('consign', 'Chủ Mới', '0912345678',
                 jsonb_build_object('building_id', $1::text, 'floor', '14', 'area', '72,5 m2', 'beds', '2', 'rent', '12.000.000 đ')) returning id`, [B])).rows[0].id as string;

  it('consign_inbox rows were copied into leads (same id, request in payload, photos kept)', async () => {
    const r = (await root(`select type, name, phone, status, assigned_to, payload->>'rent' as rent, photo_paths from public.leads where id=$1`, [consign1])).rows[0];
    expect(r).toEqual({ type: 'consign', name: 'Chủ ký gửi', phone: '0911', status: 'new', assigned_to: null, rent: '10.000.000', photo_paths: ['up1/1.jpg'] });
  });

  it('admin assigns → unit with owner data + prefilled draft, visible to the assignee', async () => {
    const c = await newConsign();
    const r = await as(id(U.admin), async (q) => {
      const lid = (await q(`select public.assign_consign_lead($1, $2, $3, 14, '14-08') as id`, [c, U.s2, B])).rows[0].id;
      const l = (await q(`select status, rent, area, beds, code, assigned_to from public.admin_listings where id=$1`, [lid])).rows[0];
      const lead = (await q(`select status, assigned_to, listing_id, payload ? 'unit_id' as has_unit from public.leads where id=$1`, [c])).rows[0];
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      const seen = (await q(`select u.owner_phone from public.units u join public.listings x on x.unit_id=u.id where x.id=$1`, [lid])).rows[0];
      const lead2 = (await q(`select id from public.leads where id=$1`, [c])).rowCount;
      const again = await denied(q(`select public.assign_consign_lead($1, $2, $3, 15, '1509')`, [c, U.s1, B]));
      return { lid, l, lead, seen, lead2, again };
    });
    expect(r.l).toMatchObject({ status: 'draft', rent: '12000000', area: '72.5', beds: 2, code: null, assigned_to: U.s2 });
    expect(r.lead).toEqual({ status: 'new', assigned_to: U.s2, listing_id: r.lid, has_unit: true });
    expect(r.seen).toEqual({ owner_phone: '0912345678' });
    expect(r.lead2).toBe(1);
    expect(r.again).toMatch(/admin only/);
  });

  it('sales cannot assign; cannot assign twice; inactive assignee refused', async () => {
    const c = await newConsign();
    expect(await as(id(U.s1), (q) => denied(q(`select public.assign_consign_lead($1, $2, $3, 1, '0101')`, [c, U.s1, B])))).toMatch(/admin only/);
    expect(await as(id(U.admin), (q) => denied(q(`select public.assign_consign_lead($1, $2, $3, 1, '0101')`, [c, U.off, B])))).toMatch(/not an active/);
    expect(await as(id(U.admin), async (q) => {
      await q(`select public.assign_consign_lead($1, $2, $3, 1, '0101')`, [c, U.s1, B]);
      return denied(q(`select public.assign_consign_lead($1, $2, $3, 2, '0201')`, [c, U.s1, B]));
    })).toMatch(/already handled/);
  });

  it('a late insert into the archive table is mirrored into leads', async () => {
    const r = await as('service', async (q) => {
      const cid = (await q(`insert into public.consign_inbox (rent, owner_name, owner_phone) values ('9tr', 'Chủ Muộn', '0999') returning id`)).rows[0].id;
      return (await q(`select type, name from public.leads where id=$1`, [cid])).rows[0];
    });
    expect(r).toEqual({ type: 'consign', name: 'Chủ Muộn' });
  });

  it('settings.hotline validated; the QN sequence is gone', async () => {
    expect(await as(id(U.admin), (q) => denied(q(`update public.settings set hotline='call me' where id=1`)))).toMatch(/check constraint/);
    expect((await root(`select to_regclass('public.listing_code_seq') as s`)).rows[0].s).toBeNull();
  });

  it('add_lead_note: assignee appends, others cannot', async () => {
    const r = await as(id(U.s1), async (q) => (await q(`select public.add_lead_note($1, 'Đã gọi, hẹn thứ 7') as n`, [lead1])).rows[0].n);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ by: U.s1, text: 'Đã gọi, hẹn thứ 7' });
    expect(await as(id(U.s2), (q) => denied(q(`select public.add_lead_note($1, 'x')`, [lead1])))).toMatch(/not allowed/);
    expect(await as('anon', (q) => denied(q(`select public.add_lead_note($1, 'x')`, [lead1])))).toMatch(/permission denied/);
  });
});

describe('search misses (migration 10)', () => {
  it('anon logs through the rpc but cannot read or write the table', async () => {
    await as('anon', async (q) => {
      await q(`select public.log_search_miss('  Vinhomes   2pn ', 'vi', '{"beds":2}')`);
      expect(await denied(q(`select * from public.search_misses`))).toMatch(/permission denied/);
      expect(await denied(q(`insert into public.search_misses (query_norm, locale) values ('xx','vi')`))).toMatch(/permission denied/);
      expect(await denied(q(`select * from public.search_miss_top()`))).toMatch(/permission denied/);
    });
  });

  it('rpc validates length, locale and parsed server-side', async () => {
    await as('anon', async (q) => {
      expect(await denied(q(`select public.log_search_miss('a', 'vi')`))).toMatch(/2–80/);
      expect(await denied(q(`select public.log_search_miss($1, 'vi')`, ['x'.repeat(81)]))).toMatch(/2–80/);
      expect(await denied(q(`select public.log_search_miss('ok query', 'de')`))).toMatch(/locale/);
      await q(`select public.log_search_miss('ok query', 'ru', '[1,2]')`); // non-object parsed → stored as {}
    });
  });

  it('only admins read; rows hold no user data', async () => {
    await root(`delete from public.search_misses`);
    // as() rolls back, so the fixture rows are written by the owner through the same function
    await root(`select public.log_search_miss('Vinhomes', 'vi'), public.log_search_miss('vinhomes', 'en'), public.log_search_miss('studio gan bien', 'vi')`);
    const cols = (await root(`select column_name from information_schema.columns where table_name = 'search_misses' order by ordinal_position`)).rows.map((r) => r.column_name);
    expect(cols).toEqual(['id', 'query_norm', 'locale', 'parsed', 'created_at']);
    const sales = await as(id(U.s1), (q) => q(`select * from public.search_misses`));
    expect(sales.rows).toEqual([]);
    expect((await as(id(U.s1), (q) => q(`select * from public.search_miss_top()`))).rows).toEqual([]);
    const top = await as(id(U.admin), (q) => q(`select query_norm, n::int, locales from public.search_miss_top(30, 10)`));
    expect(top.rows[0]).toEqual({ query_norm: 'vinhomes', n: 2, locales: ['en', 'vi'] });
    await root(`delete from public.search_misses`);
  });
});

describe('photo masters + watermark (migration 12)', () => {
  it('listing-master: private; sales only under their own listing folder; anon nothing', async () => {
    const r = await as(id(U.s1), async (q) => ({
      own: (await q(`insert into storage.objects (bucket_id, name) values ('listing-master', $1) returning id`, [`listings/${l1}/m.webp`])).rowCount,
      other: await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-master', $1)`, [`listings/${l2}/m.webp`])),
      building: await denied(q(`insert into storage.objects (bucket_id, name) values ('listing-master', 'buildings/altara/m.webp')`)),
    }));
    expect(r.own).toBe(1);
    expect(r.other).toMatch(/row-level security/);
    expect(r.building).toMatch(/row-level security/);
    await root(`insert into storage.objects (bucket_id, name) values ('listing-master', $1), ('listing-master', 'buildings/altara/m2.webp')`, [`listings/${l2}/m2.webp`]);
    const seenBy = async (who: Parameters<typeof as>[0]) => (await as(who, (q) => q(`select name from storage.objects where bucket_id = 'listing-master' order by name`))).rows.map((x) => x.name);
    expect(await seenBy(id(U.s1))).toEqual([]);
    expect(await seenBy(id(U.s2))).toEqual([`listings/${l2}/m2.webp`]);
    expect(await seenBy(id(U.admin))).toEqual(['buildings/altara/m2.webp', `listings/${l2}/m2.webp`]);
    expect(await as('anon', (q) => denied(q(`insert into storage.objects (bucket_id, name) values ('listing-master', 'buildings/altara/x.webp')`)))).toMatch(/row-level security|permission/);
    await root(`delete from storage.objects where bucket_id = 'listing-master'`);
    const b = (await root(`select public from storage.buckets where id = 'listing-master'`)).rows[0];
    expect(b.public).toBe(false);
  });

  it('watermark defaults: listing photos on, building photos off', async () => {
    const r = await root(`insert into public.photos (listing_id, bucket, path) values ($1, 'listing-public', 'listings/x/wm-a.webp') returning watermark`, [l1]);
    const b = await root(`insert into public.photos (building_id, bucket, path) values ($1, 'listing-public', 'buildings/altara/wm-b.webp') returning watermark`, [B]);
    expect([r.rows[0].watermark, b.rows[0].watermark]).toEqual([true, false]);
    await root(`delete from public.photos where path in ('listings/x/wm-a.webp', 'buildings/altara/wm-b.webp')`);
  });

  it('video_url: YouTube only, exposed in the public view', async () => {
    expect(await denied(root(`update public.listings set video_url = 'https://vimeo.com/123' where id = $1`, [l1]))).toMatch(/check/);
    await root(`update public.listings set video_url = 'https://youtu.be/dQw4w9WgXcQ' where id = $1`, [l1]);
    const v = await as('anon', (q) => q(`select video_url from public.public_listings`));
    expect(v.rows[0].video_url).toBe('https://youtu.be/dQw4w9WgXcQ');
    await root(`update public.listings set video_url = null where id = $1`, [l1]);
  });

  it('photo tag + source (migration 17): defaults, checks, reference never watermarked, exposed publicly', async () => {
    const r = await root(`insert into public.photos (building_id, bucket, path) values ($1, 'listing-public', 'buildings/altara/tg-a.webp') returning tag, source, watermark`, [B]);
    expect(r.rows[0]).toEqual({ tag: 'khac', source: null, watermark: false });
    // a reference listing photo gets no watermark by default, and can't be given one
    const ref = await root(`insert into public.photos (listing_id, bucket, path, source) values ($1, 'listing-public', 'listings/x/tg-b.webp', 'reference') returning watermark`, [l1]);
    expect(ref.rows[0].watermark).toBe(false);
    expect(await denied(root(`update public.photos set watermark = true where path = 'listings/x/tg-b.webp'`))).toMatch(/photos_reference_no_watermark/);
    expect(await denied(root(`update public.photos set tag = 'pool' where path = 'buildings/altara/tg-a.webp'`))).toMatch(/check/);
    await root(`update public.photos set tag = 'sanh', source = 'reference' where path = 'buildings/altara/tg-a.webp'`);
    const v = await as('anon', (q) => q(`select photos from public.public_buildings where slug = 'altara'`));
    expect(v.rows[0].photos).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'buildings/altara/tg-a.webp', tag: 'sanh', source: 'reference' })]));
    expect(await denied(root(`update public.buildings set video_url = 'https://vimeo.com/1' where id = $1`, [B]))).toMatch(/check/);
    await root(`delete from public.photos where path in ('buildings/altara/tg-a.webp', 'listings/x/tg-b.webp')`);
  });
});

describe('per-building codes (migration 13)', () => {
  it('prefix defaults from the slug, is unique and frozen once codes exist; counter is system-owned', async () => {
    expect((await root(`select code_prefix from public.buildings where id = $1`, [B])).rows[0].code_prefix).toBe('ALT');
    expect(await denied(root(`insert into public.buildings (slug, name, code_prefix) values ('altara-2', 'X', 'ALT')`))).toMatch(/unique|duplicate/);
    expect(await denied(root(`insert into public.buildings (slug, name, code_prefix) values ('bad', 'X', 'AB1')`))).toMatch(/check/);
    expect(await as(id(U.admin), (q) => denied(q(`update public.buildings set code_prefix = 'ALX' where id = $1`, [B])))).toMatch(/tiền tố/);
    const seq = async () => (await root(`select code_seq from public.buildings where id = $1`, [B])).rows[0].code_seq;
    const before = await seq();
    await as(id(U.admin), (q) => q(`update public.buildings set code_seq = 0, name = name where id = $1`, [B]));
    expect(await seq()).toBe(before);
  });

  it('numbers are never reused (delete) and grow to 4 digits after 999', async () => {
    const b2 = (await root(`insert into public.buildings (slug, name) values ('ecolife', 'Ecolife Riverside') returning id, code_prefix`)).rows[0];
    expect(b2.code_prefix).toBe('ECO');
    const mk = async (no: string) => {
      const u = (await root(`insert into public.units (building_id, floor, unit_no) values ($1, 3, $2) returning id`, [b2.id, no])).rows[0].id;
      const l = (await root(`insert into public.listings (unit_id) values ($1) returning id`, [u])).rows[0].id;
      await root(`update public.listings set ${COMPLETE} where id = $1`, [l]);
      return (await root(`update public.listings set status = 'available' where id = $1 returning id, code`, [l])).rows[0];
    };
    const a = await mk('a1');
    expect(a.code).toBe('ECO-001');
    await root(`delete from public.listings where id = $1`, [a.id]);
    expect((await mk('a2')).code).toBe('ECO-002');
    await root(`update public.buildings set code_seq = 999 where id = $1`, [b2.id]);
    expect((await mk('a3')).code).toBe('ECO-1000');
    // the prefix is free to change only while no listing carries a code
    expect(await denied(root(`update public.buildings set code_prefix = 'ECX' where id = $1`, [b2.id]))).toMatch(/tiền tố/);
  });

  it('legacy_code: public in the view, not writable by staff', async () => {
    await root(`alter table public.listings disable trigger guard`);
    await root(`update public.listings set legacy_code = 'QN-001' where id = $1`, [l1]);
    await root(`alter table public.listings enable trigger guard`);
    const v = await as('anon', (q) => q(`select code, legacy_code from public.public_listings where code = $1`, [code1]));
    expect(v.rows[0]).toEqual({ code: code1, legacy_code: 'QN-001' });
    await as(id(U.admin), (q) => q(`update public.listings set legacy_code = 'QN-555' where id = $1`, [l1]));
    expect((await root(`select legacy_code from public.listings where id = $1`, [l1])).rows[0].legacy_code).toBe('QN-001');
  });
});

describe('building fees (migration 14)', () => {
  it('public view shows rates but not the source note; overrides only mgmt/moto/car', async () => {
    await root(`update public.buildings set mgmt_fee_per_m2 = 12100, motorbike_fee = 60000, fee_source = 'Hoá đơn BQL', fee_verified = true where id = $1`, [B]);
    const r = await as('anon', (q) => q(`select * from public.public_buildings where slug = 'altara'`));
    expect(r.rows[0]).toMatchObject({ mgmt_fee_per_m2: 12100, motorbike_fee: 60000, fee_verified: true });
    expect(Object.keys(r.rows[0])).not.toContain('fee_source');
    const l = await as('anon', (q) => q(`select mgmt_fee_paid_by from public.public_listings limit 1`));
    expect(l.rows[0].mgmt_fee_paid_by).toBe('tenant');
    expect(await denied(root(`update public.listings set fee_overrides = '{"rent": 1}' where id = $1`, [l1]))).toMatch(/check/);
    expect(await denied(root(`update public.buildings set car_parking = 'maybe' where id = $1`, [B]))).toMatch(/check/);
  });
  it('sales cannot change building fees', async () => {
    const r = await as(id(U.s1), (q) => q(`update public.buildings set mgmt_fee_per_m2 = 1 where id = $1`, [B]));
    expect(r.rowCount).toBe(0);
  });
});

describe('consign quick contact (migration 19)', () => {
  it('public_contact exposes only the contact fields; settings stay staff-only', async () => {
    await root(`update public.settings set hotline = '0905 123 456', zalo_phone = null, contact_person_name = 'Minh Anh', contact_person_title = 'Chuyên viên' where id = 1`);
    const v = await as('anon', (q) => q(`select * from public.public_contact`));
    expect(Object.keys(v.rows[0]).sort()).toEqual(['contact_person_name', 'contact_person_photo', 'contact_person_title', 'hotline', 'zalo_phone']);
    expect(v.rows[0].hotline).toBe('0905 123 456');
    expect(await as('anon', (q) => denied(q(`select hotline from public.settings`)))).toMatch(/permission/);
    expect(await denied(root(`update public.settings set zalo_phone = 'call me' where id = 1`))).toMatch(/check/);
    expect(await denied(root(`update public.settings set contact_person_photo = '../x.png' where id = 1`))).toMatch(/check/);
    await root(`update public.settings set hotline = null, contact_person_name = null, contact_person_title = null where id = 1`);
  });

  it('contact clicks: anon logs through the rpc only, junk dropped, only admins read', async () => {
    await root(`delete from public.contact_clicks`);
    await as('anon', async (q) => {
      await q(`select public.log_contact_click('call', 'ky-gui', 'vi')`);
      await q(`select public.log_contact_click('zalo', 'ky-gui', 'en')`);
      await q(`select public.log_contact_click('sms', 'ky-gui', 'vi')`); // unknown channel → dropped
      await q(`select public.log_contact_click('call', '<script>', 'vi')`); // bad page → dropped
      expect(await denied(q(`insert into public.contact_clicks (channel, page, locale) values ('call', 'ky-gui', 'vi')`))).toMatch(/permission/);
      expect(await denied(q(`select * from public.contact_clicks`))).toMatch(/permission/);
      // (as() rolls back: check the rows inside the same transaction, back as the superuser)
      await q(`reset role`);
      expect((await q(`select channel, locale from public.contact_clicks order by id`)).rows).toEqual([{ channel: 'call', locale: 'vi' }, { channel: 'zalo', locale: 'en' }]);
    });
    await root(`insert into public.contact_clicks (channel, page, locale) values ('call', 'ky-gui', 'vi'), ('form', 'ky-gui', 'vi')`);
    expect((await as(id(U.admin), (q) => q(`select count(*)::int as n from public.contact_clicks`))).rows[0].n).toBe(2);
    expect((await as(id(U.s1), (q) => q(`select count(*)::int as n from public.contact_clicks`))).rows[0].n).toBe(0);
    await root(`delete from public.contact_clicks`);
  });
});

describe('soft delete + trash (migration 20)', () => {
  it('sales: may trash only an own listing that was never published', async () => {
    expect(await as(id(U.s1), (q) => denied(q(`select public.trash_listing($1)`, [l1])))).toMatch(/quản trị viên/); // own, published
    expect(await as(id(U.s1), (q) => denied(q(`select public.trash_listing($1)`, [l2])))).toMatch(/quản trị viên|not found/); // not own
    await as(id(U.s2), async (q) => {
      await q(`select public.trash_listing($1)`, [l2]); // own draft
      expect((await q(`select id from public.listings where id = $1`, [l2])).rowCount).toBe(0);
      expect((await q(`select id from public.admin_listings where id = $1`, [l2])).rowCount).toBe(0);
      // the undo toast: the person who trashed it may restore within 10 minutes
      await q(`select public.restore_listing($1)`, [l2]);
      expect((await q(`select status from public.listings where id = $1`, [l2])).rows[0].status).toBe('draft');
    });
  });

  it('admin: trashed listing leaves the site and every admin list; restore brings it back as it was', async () => {
    await as(id(U.admin), async (q) => {
      await q(`select public.trash_listing($1)`, [l1]);
      expect((await q(`select code from public.public_listings`)).rows.map((r) => r.code)).not.toContain(code1);
      expect((await q(`select id from public.listings where id = $1`, [l1])).rowCount).toBe(0);
      expect((await q(`select id from public.admin_listings where id = $1`, [l1])).rowCount).toBe(0);
      const t = await q(`select kind, label from public.trash_items()`);
      expect(t.rows).toEqual([{ kind: 'listing', label: `${code1} · Altara Residences Quy Nhơn` }]);
      // invisible rows can't be changed directly, only through the rpc
      expect((await q(`update public.listings set deleted_at = null where id = $1`, [l1])).rowCount).toBe(0);
      await q(`select public.restore_listing($1)`, [l1]);
      expect((await q(`select code, status from public.public_listings where code = $1`, [code1])).rows).toEqual([{ code: code1, status: 'available' }]);
    });
  });

  it('nobody sets deleted_at directly; sales and anon cannot use trash / purge', async () => {
    expect(await as(id(U.admin), (q) => denied(q(`update public.listings set deleted_at = now() where id = $1`, [l2])))).toMatch(/row-level security/);
    expect(await as(id(U.s1), (q) => denied(q(`select public.trash_items()`)))).toMatch(/admin only/);
    expect(await as(id(U.s1), (q) => denied(q(`select public.trash_leads(array[$1]::uuid[])`, [lead1])))).toMatch(/admin only/);
    expect(await as(id(U.s1), (q) => denied(q(`select public.purge_lead($1, true)`, [lead1])))).toMatch(/admin only/);
    expect(await as(id(U.s1), (q) => denied(q(`select public.trash_building($1)`, [B])))).toMatch(/admin only/);
    expect(await as('anon', (q) => denied(q(`select public.trash_listing($1)`, [l1])))).toMatch(/permission denied/);
  });

  it('a sales member cannot restore a listing an admin trashed', async () => {
    await as(id(U.admin), async (q) => {
      await q(`select public.trash_listing($1)`, [l2]);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      expect(await denied(q(`select public.restore_listing($1)`, [l2]))).toMatch(/admin only/);
    });
  });

  it('purge: lead keeps the code snapshot, unit goes, files returned, codes are never reused', async () => {
    await as(id(U.admin), async (q) => {
      await q(`select public.trash_listing($1)`, [l1]);
      await q(`reset role`);
      await q(`insert into public.photos (listing_id, bucket, path, thumb_path, master_path) values ($1, 'listing-public', 'listings/p/a.webp', 'listings/p/thumbs/a.webp', 'listings/p/a.webp')`, [l1]);
      await q(`set local role authenticated`);
      const files = (await q(`select public.purge_listing($1) as f`, [l1])).rows[0].f;
      expect(files).toEqual(expect.arrayContaining([
        { bucket: 'listing-public', path: 'listings/p/a.webp' }, { bucket: 'listing-public', path: 'listings/p/thumbs/a.webp' }, { bucket: 'listing-master', path: 'listings/p/a.webp' },
      ]));
      expect((await q(`select listing_id, listing_code from public.leads where id = $1`, [lead1])).rows[0]).toEqual({ listing_id: null, listing_code: code1 });
      expect((await q(`select id from public.units where id = $1`, [unit1])).rowCount).toBe(0);
      // the next publish in the building gets ALT-002, never ALT-001 again
      expect((await q(`update public.listings set status = 'available' where id = $1 returning code`, [lP])).rows[0].code).toBe('ALT-002');
    });
  });

  it('only trashed rows can be purged (leads: also right away for data-removal requests)', async () => {
    expect(await as(id(U.admin), (q) => denied(q(`select public.purge_listing($1)`, [l2])))).toMatch(/not in the trash/);
    expect(await as(id(U.admin), (q) => denied(q(`select public.purge_lead($1)`, [lead2])))).toMatch(/not in the trash/);
    await as(id(U.admin), async (q) => {
      await q(`select public.purge_lead($1, true)`, [lead2]);
      expect((await q(`select id from public.leads where id = $1`, [lead2])).rowCount).toBe(0);
    });
  });

  it('leads: bulk trash hides them from the assignee; restore brings them back', async () => {
    await as(id(U.admin), async (q) => {
      expect((await q(`select public.trash_leads(array[$1, $2]::uuid[]) as n`, [lead1, lead2])).rows[0].n).toBe(2);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s1, role: 'authenticated' })]);
      expect((await q(`select id from public.leads`)).rowCount).toBe(0);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.admin, role: 'authenticated' })]);
      expect((await q(`select public.restore_leads(array[$1]::uuid[]) as n`, [lead1])).rows[0].n).toBe(1);
    });
  });

  it('building: blocked while it has units; an empty one trashes, restores, and its purged prefix stays reserved', async () => {
    expect(await as(id(U.admin), (q) => denied(q(`select public.trash_building($1)`, [B])))).toMatch(/còn 4 căn/);
    await as(id(U.admin), async (q) => {
      const nb = (await q(`insert into public.buildings (slug, name, code_prefix) values ('emp', 'Empty Tower', 'EMP') returning id`)).rows[0].id;
      await q(`select public.trash_building($1)`, [nb]);
      expect((await q(`select slug from public.public_buildings where slug = 'emp'`)).rowCount).toBe(0);
      await q(`select public.restore_building($1)`, [nb]);
      expect((await q(`select slug from public.public_buildings where slug = 'emp'`)).rowCount).toBe(1);
      await q(`select public.trash_building($1)`, [nb]);
      await q(`select public.purge_building($1)`, [nb]);
      expect(await denied(q(`insert into public.buildings (slug, name, code_prefix) values ('emp2', 'Empty 2', 'EMP')`))).toMatch(/đã dùng cho một toà nhà đã xoá/);
    });
  });

  it('users: holdings block deletion; a deleted profile survives its auth user and loses all access', async () => {
    expect((await as(id(U.admin), (q) => q(`select * from public.user_holdings($1)`, [U.s1]))).rows[0]).toEqual({ units: 1, open_leads: 1 });
    expect((await as(id(U.s1), (q) => q(`select * from public.user_holdings($1)`, [U.s1]))).rowCount).toBe(0);
    await as(id(U.s2), async (q) => {
      await q(`reset role`);
      await q(`select set_config('request.jwt.claims', '', true)`);
      await q(`update public.profiles set full_name = 'Người dùng đã xoá (User s2)', email = null, active = false, deleted_at = now() where id = $1`, [U.s2]);
      await q(`delete from auth.users where id = $1`, [U.s2]);
      expect((await q(`select full_name, email from public.profiles where id = $1`, [U.s2])).rows[0]).toEqual({ full_name: 'Người dùng đã xoá (User s2)', email: null });
      await q(`set local role authenticated`);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      expect((await q(`select id from public.listings`)).rowCount).toBe(0);
    });
  });
});
