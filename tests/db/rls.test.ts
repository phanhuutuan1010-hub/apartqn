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
  it('assigns QN code on first publish', () => expect(code1).toMatch(/^QN-\d{3}$/));
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
    const r = await as('anon', (q) => q(`select slug, name from public.public_buildings`));
    expect(r.rows).toEqual([{ slug: 'altara', name: 'Altara Residences Quy Nhơn' }]);
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
    const msg = await as(id(U.s2), (q) => denied(q(`update public.listings set code='QN-999' where id=$1`, [l2])));
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

  it('consign inbox: invisible until assigned', async () => {
    expect((await as(id(U.s1), (q) => q(`select id from public.consign_inbox`))).rowCount).toBe(0);
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
    expect(r.rows[0].code).toMatch(/^QN-\d{3}$/);
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
    expect(r).toEqual([4, 4, 2, 1, 5]);
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
    expect(approved.code).toMatch(/^QN-\d{3}$/);
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
    expect(r.code).toMatch(/^QN-\d{3}$/);
  });

  it('code is permanent even for admin', async () => {
    const msg = await as(id(U.admin), (q) => denied(q(`update public.listings set code='QN-777' where id=$1`, [l1])));
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

  it('assigning consign makes it visible to the assignee', async () => {
    const n = await as(id(U.admin), async (q) => {
      await q(`update public.consign_inbox set status='assigned', assigned_to=$1 where id=$2`, [U.s1, consign1]);
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s1, role: 'authenticated' })]);
      const rows = (await q(`select id from public.consign_inbox`)).rowCount;
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

describe('consign assignment + lead notes (migration 7)', () => {
  const newConsign = async () =>
    (await root(`insert into public.consign_inbox (building_id, floor, area, beds, rent, owner_name, owner_phone)
                 values ($1, '14', '72,5 m2', '2', '12.000.000 đ', 'Chủ Mới', '0912345678') returning id`, [B])).rows[0].id as string;

  it('admin assigns → unit with owner data + prefilled draft, visible to the assignee', async () => {
    const c = await newConsign();
    const r = await as(id(U.admin), async (q) => {
      const lid = (await q(`select public.assign_consign($1, $2, $3, 14, '14-08') as id`, [c, U.s2, B])).rows[0].id;
      const l = (await q(`select status, rent, area, beds, code, assigned_to from public.admin_listings where id=$1`, [lid])).rows[0];
      const inbox = (await q(`select status, assigned_to, listing_id from public.consign_inbox where id=$1`, [c])).rows[0];
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.s2, role: 'authenticated' })]);
      const seen = (await q(`select u.owner_phone from public.units u join public.listings x on x.unit_id=u.id where x.id=$1`, [lid])).rows[0];
      const again = await denied(q(`select public.assign_consign($1, $2, $3, 15, '1509')`, [c, U.s1, B]));
      return { lid, l, inbox, seen, again };
    });
    expect(r.l).toMatchObject({ status: 'draft', rent: '12000000', area: '72.5', beds: 2, code: null, assigned_to: U.s2 });
    expect(r.inbox).toEqual({ status: 'assigned', assigned_to: U.s2, listing_id: r.lid });
    expect(r.seen).toEqual({ owner_phone: '0912345678' });
    expect(r.again).toMatch(/admin only/);
  });

  it('sales cannot assign; cannot assign twice; inactive assignee refused', async () => {
    const c = await newConsign();
    expect(await as(id(U.s1), (q) => denied(q(`select public.assign_consign($1, $2, $3, 1, '0101')`, [c, U.s1, B])))).toMatch(/admin only/);
    expect(await as(id(U.admin), (q) => denied(q(`select public.assign_consign($1, $2, $3, 1, '0101')`, [c, U.off, B])))).toMatch(/not an active/);
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
});
