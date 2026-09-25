/**
 * Apply supabase/migrations/*.sql to DATABASE_URL, in order, each in its own transaction.
 * History goes to supabase_migrations.schema_migrations — the same table the Supabase CLI uses,
 * so `supabase db push` can take over later.
 *
 *   npm run db:migrate            apply pending
 *   npm run db:migrate -- --status list applied / pending
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (see .env.example)');
  process.exit(1);
}
const dir = path.resolve(process.cwd(), 'supabase/migrations');
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const c = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } });
await c.connect();
await c.query(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
const done = new Set((await c.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version));

for (const f of files) {
  const version = f.split('_')[0];
  const name = f.replace(/^\d+_/, '').replace(/\.sql$/, '');
  if (done.has(version)) {
    console.log(`  ✓ ${f}`);
    continue;
  }
  if (process.argv.includes('--status')) {
    console.log(`  · ${f} (pending)`);
    continue;
  }
  const sql = readFileSync(path.join(dir, f), 'utf8');
  try {
    await c.query('begin');
    await c.query(sql);
    await c.query('insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)', [version, [sql], name]);
    await c.query('commit');
    console.log(`  + ${f}`);
  } catch (e) {
    await c.query('rollback');
    console.error(`  ✗ ${f}: ${(e as Error).message}`);
    await c.end();
    process.exit(1);
  }
}
await c.end();
