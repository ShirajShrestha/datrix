import { describe, it, expect, vi, beforeEach } from 'vitest';
import { localParts, isDue, buildPayload, sendToSub, _resetVapidForTests, PUSH_WINDOW_MINUTES } from '@/lib/services/push';
import { PushSub } from '@/lib/models/PushSub';

const NPT = { time: '08:00', timeZone: 'Asia/Kathmandu' };
const at = (s: string) => new Date(s);

describe('isDue (Kathmandu 08:00)', () => {
  it('window constant', () => expect(PUSH_WINDOW_MINUTES).toBe(180));
  it('not due at 07:59 local', () => expect(isDue(NPT, at('2026-10-19T02:14:00Z'))).toBe(false));
  it('due at 08:00 local', () => expect(isDue(NPT, at('2026-10-19T02:15:00Z'))).toBe(true));
  it('due at 10:45 local', () => expect(isDue(NPT, at('2026-10-19T05:00:00Z'))).toBe(true));
  it('due at exactly 180 minutes (11:00 local)', () => expect(isDue(NPT, at('2026-10-19T05:15:00Z'))).toBe(true));
  it('not due at 181 minutes (11:01 local)', () => expect(isDue(NPT, at('2026-10-19T05:16:00Z'))).toBe(false));
  it('not due when lastSentDate equals local date', () =>
    expect(isDue({ ...NPT, lastSentDate: '2026-10-19' }, at('2026-10-19T03:00:00Z'))).toBe(false));
  it('due next local day', () =>
    expect(isDue({ ...NPT, lastSentDate: '2026-10-19' }, at('2026-10-20T03:00:00Z'))).toBe(true));
  it('invalid timeZone never throws', () => {
    expect(localParts(at('2026-10-19T03:00:00Z'), 'Mars/Base')).toBeNull();
    expect(isDue({ time: '08:00', timeZone: 'Mars/Base' }, at('2026-10-19T03:00:00Z'))).toBe(false);
  });
  it('invalid time strings are not due', () => {
    for (const time of ['7:5', '25:99', '', undefined as unknown as string, 5 as unknown as string])
      expect(isDue({ time, timeZone: 'Asia/Kathmandu' }, at('2026-10-19T03:00:00Z'))).toBe(false);
  });
  it('invalid Date is not due', () => expect(isDue(NPT, new Date('x'))).toBe(false));
});

describe('localParts', () => {
  it('local date differs from UTC date', () =>
    expect(localParts(at('2026-10-18T19:00:00Z'), 'Asia/Kathmandu')).toEqual({ date: '2026-10-19', minutes: 45 }));
  it('local midnight is 0 minutes (no 24 quirk)', () =>
    expect(localParts(at('2026-10-18T18:15:00Z'), 'Asia/Kathmandu')).toEqual({ date: '2026-10-19', minutes: 0 }));
  it('Asia/Kolkata +5:30', () =>
    expect(localParts(at('2026-10-18T20:00:00Z'), 'Asia/Kolkata')).toEqual({ date: '2026-10-19', minutes: 90 }));
  it('America/New_York across spring-forward', () => {
    // 2026-03-08 07:00Z = 02:00 EST -> does not exist; 06:59Z is 01:59 EST, 07:00Z is 03:00 EDT
    expect(localParts(at('2026-03-08T06:59:00Z'), 'America/New_York')).toEqual({ date: '2026-03-08', minutes: 119 });
    expect(localParts(at('2026-03-08T07:00:00Z'), 'America/New_York')).toEqual({ date: '2026-03-08', minutes: 180 });
    expect(localParts(at('2026-03-08T03:30:00Z'), 'America/New_York')).toEqual({ date: '2026-03-07', minutes: 22 * 60 + 30 });
  });
  it('invalid Date -> null', () => expect(localParts(new Date('x'), 'UTC')).toBeNull());
});

describe('buildPayload', () => {
  const a = (title: string) => ({ title });
  it('generic body for 0 articles', () => {
    const p = buildPayload([]);
    expect(p.body).toBe('Fresh stories are ready.');
    expect(p.url).toBe('/');
    expect(p.title).toContain('Datrix');
  });
  it('exactly 3 headlines of 5', () => {
    const p = buildPayload(['one', 'two', 'three', 'four', 'five'].map(a));
    expect(p.body).toBe('one • two • three');
  });
  it('truncates long titles', () => {
    const p = buildPayload([a('x'.repeat(200))]);
    expect(p.body.length).toBe(90);
    expect(p.body.endsWith('…')).toBe(true);
  });
  it('strips control chars and angle brackets', () => {
    const p = buildPayload([a('Hi\u0000\n<b>there</b>\u0007')]);
    expect(p.body).toBe('Hi bthere/b');
  });
  it('body <= 240', () => {
    expect(buildPayload(Array.from({ length: 20 }, () => a('y'.repeat(200))), 20).body.length).toBeLessThanOrEqual(240);
  });
});

describe('sendToSub', () => {
  const sub = { endpoint: 'https://push.test/abc', keys: { p256dh: 'p', auth: 'a' } };
  beforeEach(() => {
    _resetVapidForTests();
    vi.unstubAllEnvs();
  });
  const setEnv = () => {
    // valid P-256 VAPID keypair format (throwaway, test only)
    vi.stubEnv('VAPID_SUBJECT', 'mailto:test@example.com');
    vi.stubEnv('VAPID_PUBLIC_KEY', 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls');
  };
  it('sent', async () => {
    setEnv();
    const sender = vi.fn().mockResolvedValue({});
    expect(await sendToSub(sub, { a: 1 }, { sender })).toBe('sent');
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0][2]).toMatchObject({ TTL: 21600, urgency: 'normal' });
  });
  it.each([[410, 'gone'], [404, 'gone'], [500, 'error']])('status %i -> %s', async (statusCode, out) => {
    setEnv();
    const sender = vi.fn().mockRejectedValue({ statusCode });
    expect(await sendToSub(sub, {}, { sender })).toBe(out);
  });
  it('missing env -> error, sender not called, warns names only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VAPID_SUBJECT', '');
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    const sender = vi.fn();
    expect(await sendToSub(sub, {}, { sender })).toBe('error');
    expect(sender).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('VAPID_PRIVATE_KEY');
    warn.mockRestore();
  });
});

describe('PushSub schema', () => {
  const valid = () => ({
    endpoint: 'https://push.test/x', keys: { p256dh: 'p', auth: 'a' },
    categories: ['ai'], time: '08:00', timeZone: 'Asia/Kathmandu',
  });
  it('accepts valid and empty categories', () => {
    expect(new PushSub(valid()).validateSync()).toBeUndefined();
    expect(new PushSub({ ...valid(), categories: [] }).validateSync()).toBeUndefined();
  });
  it('rejects bad time / timeZone / category', () => {
    expect(new PushSub({ ...valid(), time: '7:5' }).validateSync()?.errors.time).toBeDefined();
    expect(new PushSub({ ...valid(), time: '24:00' }).validateSync()?.errors.time).toBeDefined();
    expect(new PushSub({ ...valid(), timeZone: 'Mars/Base' }).validateSync()?.errors.timeZone).toBeDefined();
    expect(new PushSub({ ...valid(), categories: ['nope'] }).validateSync()?.errors.categories).toBeDefined();
  });
});
