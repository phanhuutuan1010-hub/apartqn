/**
 * Starts a throwaway Postgres 17 (embedded-postgres, no Docker). For each test database it loads the
 * Supabase stub + every migration in supabase/migrations, then exposes the URLs to the tests:
 *   TEST_DB_URL         RLS/RPC tests of the current schema (fixtures inserted by the tests)
 *   TEST_LEGACY_DB_URL  the schema as it was before the unit-type pivot (migrations ≤ 40, the listings era): the
 *                       historical RLS suite (rls.test.ts) keeps checking those migrations as they ran
 *   TEST_SEED_DB_URL    empty schema for the seed script test
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const PORT = 54329;
/** last migration of the listings era (41 archives listings and introduces unit types) */
const LISTINGS_ERA = '20261017000040';
const base = `postgres://postgres:postgres@localhost:${PORT}`;
let server: EmbeddedPostgres | undefined;
let dir = '';

/** `upTo`: last migration version to load (inclusive); everything when omitted */
async function prepare(dbName: string, upTo?: string) {
  if (dbName !== 'postgres') {
    const admin = new pg.Client({ connectionString: `${base}/postgres` });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
  }
  const c = new pg.Client({ connectionString: `${base}/${dbName}` });
  await c.connect();
  const root = path.resolve(__dirname, '../../supabase');
  await c.query(readFileSync(path.join(root, 'tests/supabase-stub.sql'), 'utf8'));
  for (const f of readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql') && (!upTo || f.split('_')[0] <= upTo)).sort()) {
    try {
      await c.query(readFileSync(path.join(root, 'migrations', f), 'utf8'));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await c.end();
  return `${base}/${dbName}`;
}

export async function setup() {
  dir = mkdtempSync(path.join(tmpdir(), 'aqn-pg-'));
  server = new EmbeddedPostgres({
    databaseDir: dir, user: 'postgres', password: 'postgres', port: PORT, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {},
  });
  await server.initialise();
  await server.start();
  process.env.TEST_DB_URL = await prepare('postgres');
  process.env.TEST_LEGACY_DB_URL = await prepare('aqn_legacy', LISTINGS_ERA);
  process.env.TEST_SEED_DB_URL = await prepare('aqn_seed');
}

export async function teardown() {
  await server?.stop();
  if (dir) rmSync(dir, { recursive: true, force: true });
}
