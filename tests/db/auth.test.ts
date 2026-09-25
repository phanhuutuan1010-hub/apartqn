/**
 * The Supabase Auth server (GoTrue) inserts into auth.users on its own connection
 * (session_user = supabase_auth_admin, no JWT claims). The profile trigger must work there.
 */
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { as, close, denied, root } from './helpers';

const gotrue = () => new pg.Client({ connectionString: process.env.TEST_DB_URL!.replace('postgres:postgres@', 'supabase_auth_admin:auth@') });
afterAll(async () => {
  await root(`delete from auth.users where email like '%@test.vn' and id::text like 'cccccccc-%'`);
  await close();
});

describe('auth.users → profiles (GoTrue connection)', () => {
  it('invite/signup insert by supabase_auth_admin creates a sales profile', async () => {
    const c = gotrue();
    await c.connect();
    const id = 'cccccccc-0000-0000-0000-000000000001';
    await c.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'gotrue@test.vn', '{"full_name":"Qua GoTrue"}')`, [id]);
    await c.end();
    const p = (await root(`select email, full_name, role, can_publish, active from public.profiles where id=$1`, [id])).rows[0];
    expect(p).toEqual({ email: 'gotrue@test.vn', full_name: 'Qua GoTrue', role: 'sales', can_publish: false, active: true });
  });

  it('API callers still cannot insert profiles directly (invite-only)', async () => {
    const msg = await as({ id: 'cccccccc-0000-0000-0000-000000000001' }, (q) =>
      denied(q(`insert into public.profiles (id, email) values ('cccccccc-0000-0000-0000-000000000009', 'x@y.z')`)));
    expect(msg).toMatch(/invite only|row-level security/);
  });

  it('the bypass flag does not leak out of the trigger', async () => {
    const c = gotrue();
    await c.connect();
    await c.query('begin');
    await c.query(`insert into auth.users (id, email) values ('cccccccc-0000-0000-0000-000000000002', 'leak@test.vn')`);
    const flag = (await c.query(`select coalesce(current_setting('app.rpc', true), '') v`)).rows[0].v;
    await c.query('rollback');
    await c.end();
    expect(flag).not.toBe('on');
  });
});
