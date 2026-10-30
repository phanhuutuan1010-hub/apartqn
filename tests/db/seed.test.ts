/**
 * Runs scripts/seed.mts against an empty migrated database (twice — must be idempotent), then reads the
 * public views as anon through the same mapper the site uses and compares with the handoff buildings.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUILDINGS } from '@/data/buildings';
import { toBuilding, type PublicBuildingRow } from '@/lib/repoMap';

const SB = 'https://example.supabase.co';
let c: pg.Client;

const runSeed = () =>
  execFileSync(process.execPath, ['--import', 'tsx', path.resolve('scripts/seed.mts'), '--no-photos'], {
    env: { ...process.env, DATABASE_URL: process.env.TEST_SEED_DB_URL },
    encoding: 'utf8',
  });

async function asAnon<T>(sql: string): Promise<T[]> {
  await c.query('begin');
  await c.query('set local role anon');
  await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
  const r = await c.query(sql);
  await c.query('rollback');
  return r.rows as T[];
}

beforeAll(async () => {
  const out1 = runSeed();
  const out2 = runSeed();
  expect(out1).toContain('+ building altara');
  expect(out2).not.toMatch(/^\+ /m); // second run changes nothing
  c = new pg.Client({ connectionString: process.env.TEST_SEED_DB_URL });
  await c.connect();
}, 120000);
afterAll(() => c?.end());

describe('seed → public views', () => {
  it('buildings match the handoff (slug, name, street, amenities, demo)', async () => {
    const rows = await asAnon<PublicBuildingRow>('select * from public.public_buildings order by sort');
    const handoff = new Set(BUILDINGS.map((b) => b.id));
    const got = rows.map((r) => toBuilding(r, SB)).filter((b) => handoff.has(b.id)); // + 4 buildings added by migration 14
    expect(got.map(({ id, name, street, amenities, demo }) => ({ id, name, street, amenities, demo }))).toEqual(
      BUILDINGS.map(({ id, name, street, amenities, demo }) => ({ id, name, street, amenities, demo })),
    );
    // never invented: no ward / coordinates
    got.forEach((b) => expect([b.ward, b.lat, b.lng]).toEqual([undefined, undefined, undefined]));
  });

  it('every building has its four hidden, empty unit type drafts; nothing is public until filled in', async () => {
    const r = await c.query(`select b.slug, array_agg(t.code order by t.sort) codes, bool_or(t.is_visible) shown, bool_or(t.price_from is not null) priced
      from public.buildings b join public.unit_types t on t.building_id = b.id group by b.slug`);
    const PREFIX = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.prefix]));
    for (const row of r.rows.filter((x) => PREFIX[x.slug])) {
      expect(row.codes).toEqual(['STUDIO', '1PN', '2PN', '3PN'].map((t) => `${PREFIX[row.slug]}-${t}`));
      expect([row.shown, row.priced]).toEqual([false, false]);
    }
    expect(await asAnon('select * from public.public_unit_types')).toEqual([]);
  });

  it('no listings are imported', async () => {
    const r = await c.query('select count(*)::int n from public.listings');
    expect(r.rows[0].n).toBe(0);
  });
});
