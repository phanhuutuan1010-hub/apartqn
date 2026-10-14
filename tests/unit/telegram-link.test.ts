import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
let mod: typeof import('@/lib/telegramLink');
beforeAll(async () => { process.env.TELEGRAM_BOT_TOKEN = '123456:TEST-TOKEN'; mod = await import('@/lib/telegramLink'); });

describe('Telegram connect link', () => {
  const id = '0b1e7c1e-5f0a-4c2b-9a3d-1234567890ab';
  it('token fits a Telegram start parameter and round-trips to the profile id', () => {
    const t = mod.linkToken(id);
    expect(t).toMatch(/^[0-9a-f]{32}_[0-9a-f]{24}$/);
    expect(t.length).toBeLessThanOrEqual(64);
    expect(mod.parseLinkToken(t)).toBe(id);
  });
  it('a forged or damaged token is refused', () => {
    const t = mod.linkToken(id);
    expect(mod.parseLinkToken(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'))).toBeNull();
    expect(mod.parseLinkToken('ffffffffffffffffffffffffffffffff_' + t.split('_')[1])).toBeNull();
    expect(mod.parseLinkToken('hello')).toBeNull();
  });
  it('webhook secret is stable and safe for the Telegram header', () => {
    expect(mod.webhookSecret()).toMatch(/^[0-9a-f]{40}$/);
    expect(mod.webhookSecret()).toBe(mod.webhookSecret());
  });
});
