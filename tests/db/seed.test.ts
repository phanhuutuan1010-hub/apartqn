/**
 * Runs scripts/seed.mts against an empty migrated database (twice — must be idempotent), then reads the
 * public views as anon through the same mapper the site uses and compares with the handoff data.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUILDINGS } from '@/data/buildings';
import { LISTINGS } from '@/data/listings';
import { toBuilding, toListing, type PublicBuildingRow, type PublicListingRow } from '@/lib/repoMap';

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
  expect(out1).toContain('+ listing QN-001');
  expect(out2).not.toMatch(/^\+ /m); // second run changes nothing
  c = new pg.Client({ connectionString: process.env.TEST_SEED_DB_URL });
  await c.connect();
}, 120000);
afterAll(() => c?.end());

describe('seed → public views', () => {
  it('buildings match the handoff (slug, name, street, amenities, demo)', async () => {
    const rows = await asAnon<PublicBuildingRow>('select * from public.public_buildings order by sort');
    const got = rows.map((r) => toBuilding(r, SB));
    expect(got.map(({ id, name, street, amenities, demo }) => ({ id, name, street, amenities, demo }))).toEqual(
      BUILDINGS.map(({ id, name, street, amenities, demo }) => ({ id, name, street, amenities, demo })),
    );
    // never invented: no ward / coordinates
    got.forEach((b) => expect([b.ward, b.lat, b.lng]).toEqual([undefined, undefined, undefined]));
  });

  it('listings match the handoff field by field (incl. rented, demo flag, dates)', async () => {
    const rows = await asAnon<PublicListingRow>('select * from public.public_listings order by code');
    const got = rows.map((r) => toListing(r, SB));
    const strip = (x: Record<string, unknown>) => {
      const { photos, thumbs, desc, photoCount, verifiedAt, publishedAt, ...rest } = x;
      void photos; void thumbs; void desc;
      // set by the import (now()), not part of the handoff data
      expect(typeof verifiedAt === 'string' || verifiedAt === undefined).toBe(true);
      expect(typeof publishedAt === 'string' || publishedAt === undefined).toBe(true);
      return { ...rest, photoCount };
    };
    expect(got.map(strip)).toEqual(
      LISTINGS.map((x) => {
        const { photos, ...rest } = x;
        void photos;
        return rest;
      }),
    );
  });

  it('no internal columns in the public view', async () => {
    const r = await asAnon<Record<string, unknown>>('select * from public.public_listings limit 1');
    expect(Object.keys(r[0]).filter((k) => /owner|unit|assigned|created_by|updated_by|rejection/.test(k))).toEqual([]);
  });

  it('demo units carry no owner data', async () => {
    const r = await c.query(`select count(*)::int n from public.units where owner_name is not null or owner_phone is not null`);
    expect(r.rows[0].n).toBe(0);
  });

  it('next code continues after the imported ones', async () => {
    const r = await c.query(`select last_value::int v from public.listing_code_seq`);
    expect(r.rows[0].v).toBe(9);
  });
});
