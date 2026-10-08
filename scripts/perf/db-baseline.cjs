/* eslint-disable @typescript-eslint/no-require-imports */
// Perf measurement helper (read-only). Run: node --env-file=.env.local scripts/perf/db-baseline.cjs
const pg = require('pg');
(async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = (s, p) => c.query(s, p);
  console.log('rows:', (await q(`select (select count(*) from listings) l, (select count(*) from units) u, (select count(*) from photos) ph, (select count(*) from leads) le, (select count(*) from profiles) pr, (select count(*) from consign_inbox) ci`)).rows[0]);
  const staff = (await q(`select id, role, active from profiles order by role`)).rows;
  console.log('staff', staff.map(s => s.role + (s.active ? '' : '(off)')));
  console.log('indexes:', (await q(`select tablename, indexname from pg_indexes where schemaname='public' order by 1,2`)).rows.map(r => r.tablename + '.' + r.indexname).join(' '));
  const ext = (await q(`select extname from pg_extension`)).rows.map(r => r.extname);
  console.log('ext', ext.join(','));
  const asRole = async (uid, sql) => {
    await q('begin');
    await q(`set local role authenticated`);
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);

    const r = await q('explain (analyze, buffers, format text) ' + sql);
    await q('rollback');
    const exec = r.rows.map(x => x['QUERY PLAN']).find(l => /Execution Time/.test(l));
    const plan = r.rows.map(x => x['QUERY PLAN']).find(l => /Planning Time/.test(l));
    return `${exec} ${plan}`;
  };
  const sales = staff.find(s => s.role === 'sales' && s.active), admin = staff.find(s => s.role === 'admin');
  const Q = {
    listings: `select * from admin_listings order by updated_at desc nulls last, created_at desc limit 20`,
    listingsCount: `select count(*) from admin_listings`,
    pending: `select count(*) from listings where status='pending'`,
    leads: `select l.id, l.name, l.status, (select code from listings x where x.id=l.listing_id) from leads l where status='new' order by created_at desc limit 25`,
    consign: `select * from consign_inbox where status='new' order by created_at desc limit 25`,
    profile: `select id, email, full_name, role, can_publish from profiles where id = '${admin?.id}'`,
    directory: `select * from staff_directory()`,
  };
  for (const [who, u] of [['admin', admin], ['sales', sales]]) {
    if (!u) continue;
    for (const [k, sql] of Object.entries(Q)) console.log(who, k, await asRole(u.id, sql).catch(e => 'ERR ' + e.message));
  }
  if (ext.includes('pg_stat_statements')) {
    const r = await q(`select calls, round(mean_exec_time::numeric,2) mean_ms, round(total_exec_time::numeric,0) total_ms, left(regexp_replace(query, '\s+', ' ', 'g'), 110) q from extensions.pg_stat_statements where query not ilike '%pg_stat%' order by mean_exec_time desc limit 12`).catch(e => ({ rows: [{ err: e.message }] }));
    console.table(r.rows);
  }
  await c.end();
})();
