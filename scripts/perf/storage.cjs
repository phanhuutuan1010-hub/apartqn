/* eslint-disable @typescript-eslint/no-require-imports */
// Storage / photo inventory (read-only). Run: node --env-file=.env.local scripts/perf/storage.cjs
const pg = require('pg');
(async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.table((await c.query(`select bucket_id, count(*)::int files, round(sum((metadata->>'size')::bigint)/1048576.0, 2) mb from storage.objects group by 1 order by 1`)).rows);
  console.table((await c.query(`select bucket, visibility, (listing_id is not null) listing, (building_id is not null) building, (unit_id is not null) unit, count(*)::int n, count(thumb_path)::int thumbs from public.photos group by 1,2,3,4,5`)).rows);
  console.log((await c.query(`select round(pg_database_size(current_database())/1048576.0,1) db_mb`)).rows[0]);
  console.log((await c.query(`select id, public, file_size_limit, allowed_mime_types from storage.buckets`)).rows);
  await c.end();
})();
