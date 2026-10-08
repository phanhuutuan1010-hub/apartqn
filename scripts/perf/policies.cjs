/* eslint-disable @typescript-eslint/no-require-imports */
// Perf measurement helper (read-only). Run: node --env-file=.env.local scripts/perf/policies.cjs
const pg = require('pg');
(async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2`);
  for (const p of r.rows) if (/auth\.uid\(\)|auth\.role\(\)|private\.\w+\(\)/.test((p.qual || '') + (p.with_check || ''))) console.log(`${p.tablename}.${p.policyname} [${p.cmd}] USING ${p.qual} CHECK ${p.with_check}`);
  // unindexed foreign keys
  const fk = await c.query(`
    select c.conrelid::regclass t, a.attname col from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum = c.conkey[1]
    where c.contype='f' and c.connamespace='public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])`);
  console.log('unindexed FKs:', fk.rows.map(r => r.t + '.' + r.col).join(', '));
  await c.end();
})();
