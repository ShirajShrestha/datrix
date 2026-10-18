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
  it('strips bidi/invisible chars', () => {
    expect(buildPayload([a('a\u202Eb\u200Bc\uFEFFd\u2066e')]).body).toBe('abcde');
  });
  it('ignores non-string titles', () => {
    expect(buildPayload([{ title: 5 as unknown as string }, a('ok')]).body).toBe('ok');
  });
  it('does not split emoji at truncation boundary', () => {
    const p = buildPayload([a('x'.repeat(88) + '😀😀😀')]);
    expect(p.body).toBe('x'.repeat(88) + '😀…');
    expect(p.body).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
  });
  it('body <= 240', () => {
    expect(buildPayload(Array.from({ length: 20 }, () => a('y'.repeat(200))), 20).body.length).toBeLessThanOrEqual(240);
  });
});

describe('sendToSub', () => {
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
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
    expect(sender.mock.calls[0][2]).toMatchObject({ TTL: 21600, urgency: 'normal', timeout: 10000 });
  });
  it.each([[410, 'gone'], [404, 'gone'], [500, 'error']])('status %i -> %s', async (statusCode, out) => {
    setEnv();
    const sender = vi.fn().mockRejectedValue({ statusCode });
    expect(await sendToSub(sub, {}, { sender })).toBe(out);
  });
  it('timeout error (no statusCode) -> error', async () => {
    setEnv();
    expect(await sendToSub(sub, {}, { sender: vi.fn().mockRejectedValue(new Error('timeout')) })).toBe('error');
  });
  it('null rejection -> error', async () => {
    setEnv();
    expect(await sendToSub(sub, {}, { sender: vi.fn().mockRejectedValue(null) })).toBe('error');
  });
  it('error warn never leaks endpoint/keys/message', async () => {
    setEnv();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = Object.assign(new Error(sub.endpoint + ' p a'), { statusCode: 500 });
    await sendToSub(sub, { secret: 'payload' }, { sender: vi.fn().mockRejectedValue(e) });
    const out = JSON.stringify(warn.mock.calls);
    expect(out).toContain('500');
    expect(out).not.toContain('push.test');
    expect(out).not.toContain('payload');
    warn.mockRestore();
  });
  it('invalid VAPID keys warn only once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('VAPID_SUBJECT', 'mailto:t@example.com');
    vi.stubEnv('VAPID_PUBLIC_KEY', 'bad');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'bad');
    const sender = vi.fn();
    expect(await sendToSub(sub, {}, { sender })).toBe('error');
    expect(await sendToSub(sub, {}, { sender })).toBe('error');
    expect(sender).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
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
    endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' },
    categories: ['ai'], time: '08:00', timeZone: 'Asia/Kathmandu',
  });
  it('accepts valid and empty categories', () => {
    expect(new PushSub(valid()).validateSync()).toBeUndefined();
    expect(new PushSub({ ...valid(), categories: [] }).validateSync()).toBeUndefined();
  });
  it('declares unique endpoint index', () => {
    const idx = PushSub.schema.indexes() as [Record<string, number>, Record<string, unknown>][];
    expect(idx.some(([f, o]) => f.endpoint === 1 && o.unique === true)).toBe(true);
  });
  it('rejects non-padded lastSentDate', () => {
    expect(new PushSub({ ...valid(), lastSentDate: '2026-1-1' }).validateSync()?.errors.lastSentDate).toBeDefined();
  });
  it('rejects bad time / timeZone / category', () => {
    expect(new PushSub({ ...valid(), time: '7:5' }).validateSync()?.errors.time).toBeDefined();
    expect(new PushSub({ ...valid(), time: '24:00' }).validateSync()?.errors.time).toBeDefined();
    expect(new PushSub({ ...valid(), timeZone: 'Mars/Base' }).validateSync()?.errors.timeZone).toBeDefined();
    expect(new PushSub({ ...valid(), categories: ['nope'] }).validateSync()?.errors.categories).toBeDefined();
  });
});

import { isAllowedPushEndpoint, validateSubscribeBody } from '@/lib/services/push';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://abc.push.apple.com/x',
    'https://wns2-par02p.notify.windows.com/?token=x',
    'https://foo.push.microsoft.com/x',
    'https://FCM.GoogleAPIs.com/fcm/send/abc',
    'HTTPS://Web.Push.Apple.COM/abc',
  ])('allows %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(true));
  it.each([
    'http://fcm.googleapis.com/x',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evil.com/fcm.googleapis.com',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com@evil.com/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://169.254.169.254/x',
    'https://localhost',
    'https://fcm.googleapis.com:8443/x',
    'https://evilpush.apple.com.evil.com/x',
    'https://notpush.apple.com/x',
    'garbage',
    '',
    'https://fcm.googleapis.com/' + 'a'.repeat(1000),
  ])('rejects %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(false));
  it('rejects non-strings', () => expect(isAllowedPushEndpoint(5 as unknown as string)).toBe(false));
});

describe('validateSubscribeBody', () => {
  const good = () => ({
    subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'BNc_-abc=', auth: 'abc_-123' } },
    categories: ['ai', 'tech', 'bogus', 'ai'],
    time: '08:00',
    timeZone: 'Asia/Kathmandu',
  });
  it('accepts valid body, normalizes categories', () => {
    const r = validateSubscribeBody(good());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.categories).toEqual(['ai', 'technology']);
  });
  it('allows empty categories', () => {
    const r = validateSubscribeBody({ ...good(), categories: [] });
    expect(r.ok && r.value.categories).toEqual([]);
  });
  it('rejects http endpoint', () => {
    const b = good(); b.subscription.endpoint = 'http://fcm.googleapis.com/x';
    expect(validateSubscribeBody(b).ok).toBe(false);
  });
  it('rejects evil host', () => {
    const b = good(); b.subscription.endpoint = 'https://evil.com/x';
    expect(validateSubscribeBody(b).ok).toBe(false);
  });
  it('rejects bad time', () => {
    expect(validateSubscribeBody({ ...good(), time: '25:00' }).ok).toBe(false);
    expect(validateSubscribeBody({ ...good(), time: '8:00' }).ok).toBe(false);
  });
  it('rejects invalid timeZone', () => {
    expect(validateSubscribeBody({ ...good(), timeZone: 'Mars/Base' }).ok).toBe(false);
  });
  it('rejects bad keys', () => {
    const b = good(); b.subscription.keys.auth = 'a b!';
    expect(validateSubscribeBody(b).ok).toBe(false);
    const c = good(); c.subscription.keys.p256dh = 'a'.repeat(201);
    expect(validateSubscribeBody(c).ok).toBe(false);
  });
  it('rejects too many / non-string categories', () => {
    expect(validateSubscribeBody({ ...good(), categories: Array(15).fill('ai') }).ok).toBe(false);
    expect(validateSubscribeBody({ ...good(), categories: [1] }).ok).toBe(false);
    expect(validateSubscribeBody({ ...good(), categories: 'ai' }).ok).toBe(false);
  });
  it('rejects non-objects', () => {
    for (const v of [null, undefined, 'x', 5, [], { subscription: 'x' }]) expect(validateSubscribeBody(v).ok).toBe(false);
  });
});

describe('endpoint hardening', () => {
  it.each([
    'https://fcm.googleapis.com\\@evil.com/x',
    'https://fcm.googleapis.com/x\ny',
    'https://fcm.googleapis.com\t.evil.com/x',
    'https://fcm.googleapis.com /x',
    'https://fcm.googleapis.com./x',
    'https://fcm%2egoogleapis.com/x',
    'https://fcm.googleapis%2ecom/x',
    'https://xn--fcm-googleapis-abc.com/x',
    'https://xn--80ak6aa92e.push.apple.com.evil.com/x',
  ])('rejects %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(false));
  it('accepts canonical endpoint', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
  });
  const body = (endpoint: string) => ({
    subscription: { endpoint, keys: { p256dh: 'abc', auth: 'def' } }, categories: [], time: '08:00', timeZone: 'UTC',
  });
  it('validate accepts canonical lowercase, rejects uppercase host (href differs) - documented', () => {
    expect(validateSubscribeBody(body('https://fcm.googleapis.com/fcm/send/abc')).ok).toBe(true);
    expect(validateSubscribeBody(body('https://FCM.googleapis.com/fcm/send/abc')).ok).toBe(false);
  });
  it('sendToSub refuses disallowed endpoints without sending', async () => {
    const sender = vi.fn();
    const r = await sendToSub({ endpoint: 'https://evil.com/x', keys: { p256dh: 'p', auth: 'a' } }, {}, { sender: sender as never });
    expect(r).toBe('error');
    expect(sender).not.toHaveBeenCalled();
  });
});

import { sendToSubDetailed } from '@/lib/services/push';
describe('sendToSubDetailed status mapping', () => {
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
  beforeEach(() => { process.env.VAPID_SUBJECT = 'mailto:a@b.co'; process.env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'; process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls'; _resetVapidForTests(); });
  const fail = (statusCode: number) => vi.fn().mockRejectedValue(Object.assign(new Error('x'), { statusCode }));
  it('404/410 -> gone', async () => {
    expect((await sendToSubDetailed(sub, {}, { sender: fail(410) as never })).result).toBe('gone');
    expect((await sendToSubDetailed(sub, {}, { sender: fail(404) as never })).result).toBe('gone');
  });
  it('400 -> error with statusCode', async () => {
    expect(await sendToSubDetailed(sub, {}, { sender: fail(400) as never })).toEqual({ result: 'error', statusCode: 400 });
  });
});
