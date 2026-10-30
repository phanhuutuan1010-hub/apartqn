/**
 * Full data export (before risky migrations): every table in `public` + the migration history + the storage object
 * manifest (bucket, name, size — the files themselves stay in Supabase Storage) → out/backup-{YYYY-MM-DD}.zip with
 * json/ (exact rows, restorable) and csv/ (UTF-8 BOM, opens in Excel). Read-only. out/ is git-ignored.
 *
 *   npm run db:backup
 *
 * CONTAINS OWNER AND CUSTOMER DATA — keep the file somewhere safe.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { strToU8, zipSync } from 'fflate';
import { toCsv } from '../lib/admin/csv';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = new pg.Client({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false } });
await db.connect();

const files: Record<string, Uint8Array> = {};
const counts: [string, number][] = [];
const add = (name: string, rows: Record<string, unknown>[]) => {
  files[`json/${name}.json`] = strToU8(JSON.stringify(rows, null, 2));
  files[`csv/${name}.csv`] = strToU8(toCsv(rows));
  counts.push([name, rows.length]);
};

const tables = (await db.query(`select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)).rows.map((r) => r.table_name as string);
for (const t of tables) add(t, (await db.query(`select * from public."${t}"`)).rows);
add('_schema_migrations', (await db.query('select version, name from supabase_migrations.schema_migrations order by version')).rows);
add('_storage_objects', (await db.query(`select bucket_id, name, (metadata->>'size')::bigint as size, metadata->>'mimetype' as mimetype, created_at
  from storage.objects order by bucket_id, name`)).rows);
await db.end();

const now = new Date();
const day = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
files['README.txt'] = strToU8(
  `ApartQN · full export ${now.toISOString()}\r\n\r\n` + counts.map(([t, n]) => `${t}: ${n}`).join('\r\n') +
  `\r\n\r\njson/ = exact rows (restore). csv/ = Excel / Google Sheets (UTF-8).\r\n` +
  `_storage_objects = manifest only; the photo files stay in Supabase Storage.\r\n` +
  `CONTAINS OWNER AND CUSTOMER DATA — keep it somewhere safe.\r\n`,
);
const out = path.resolve(process.cwd(), 'out');
mkdirSync(out, { recursive: true });
const file = path.join(out, `backup-${day}.zip`);
writeFileSync(file, zipSync(files, { level: 6 }));
console.log(counts.map(([t, n]) => `  ${t}: ${n}`).join('\n'));
console.log(`→ ${file}`);
