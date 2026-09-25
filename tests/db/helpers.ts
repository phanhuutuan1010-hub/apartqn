import pg from 'pg';

export type Who = { id: string } | 'anon' | 'service';

let pool: pg.Pool | undefined;
export const db = () => (pool ??= new pg.Pool({ connectionString: process.env.TEST_DB_URL, max: 4 }));

/** Run `fn` as a Supabase API caller (role + JWT claims), always rolled back. */
export async function as<T>(who: Who, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try {
    await c.query('begin');
    if (who === 'anon') {
      await c.query(`set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else if (who === 'service') {
      await c.query(`set local role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    } else {
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: who.id, role: 'authenticated' }),
      ]);
    }
    // Each statement runs in a savepoint so an expected rejection does not abort the transaction.
    return await fn(async (sql, params) => {
      await c.query('savepoint s');
      try {
        const r = await c.query(sql, params);
        await c.query('release savepoint s');
        return r;
      } catch (e) {
        await c.query('rollback to savepoint s');
        throw e;
      }
    });
  } finally {
    await c.query('rollback').catch(() => {});
    c.release();
  }
}

/** Expect a statement to fail; returns the error message. */
export async function denied(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('expected the statement to be rejected, but it succeeded');
}

/** Superuser (migration owner) query — used for fixtures only. */
export const root = (sql: string, params?: unknown[]) => db().query(sql, params);

export async function close() {
  await pool?.end();
  pool = undefined;
}
