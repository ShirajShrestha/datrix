import webpush from 'web-push';

export const PUSH_WINDOW_MINUTES = 180;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function localParts(now: Date, timeZone: string): { date: string; minutes: number } | null {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  if (typeof timeZone !== 'string' || !timeZone) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
    const hour = Number(p.hour) % 24; // some engines emit '24' at midnight
    const minute = Number(p.minute);
    if (!p.year || !p.month || !p.day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

// Note: the window does not wrap past local midnight. A preference at 23:00 is only due
// until 23:59 local because lastSentDate is keyed to the local date; wrapping would risk double sends.
export function isDue(
  sub: { time: string; timeZone: string; lastSentDate?: string },
  now: Date,
): boolean {
  try {
    if (!sub || typeof sub.time !== 'string' || !TIME_RE.test(sub.time)) return false;
    const local = localParts(now, sub.timeZone);
    if (!local) return false;
    const [h, m] = sub.time.split(':').map(Number);
    const delta = local.minutes - (h * 60 + m);
    if (delta < 0 || delta > PUSH_WINDOW_MINUTES) return false;
    return sub.lastSentDate !== local.date;
  } catch {
    return false;
  }
}

function cleanHeadline(s: string): string {
  const t = s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cps = Array.from(t);
  return cps.length > 90 ? cps.slice(0, 89).join('').trimEnd() + '…' : t;
}

export function buildPayload(
  articles: { title: string; summary?: { tldr?: string } }[],
  count = 3,
): { title: string; body: string; url: '/' } {
  const heads = (articles ?? [])
    .map((a) => cleanHeadline(typeof a?.title === 'string' ? a.title : ''))
    .filter(Boolean)
    .slice(0, Math.max(0, count));
  let body = heads.length ? heads.join(' • ') : 'Fresh stories are ready.';
  if (body.length > 240) {
    const cps = Array.from(body);
    body = cps.length > 240 ? cps.slice(0, 239).join('').trimEnd() + '…' : body;
    while (body.length > 240) body = Array.from(body).slice(0, -2).join('') + '…';
  }
  return { title: 'Datrix - Your morning briefing', body, url: '/' };
}

let vapidReady = false;
let vapidWarned = false;

function warnOnce(msg: string): void {
  if (vapidWarned) return;
  vapidWarned = true;
  console.warn(msg);
}

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const names = ['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    warnOnce(`Push disabled: missing env ${missing.join(', ')}`);
    return false;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT as string,
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    vapidReady = true;
    return true;
  } catch {
    warnOnce('Push disabled: invalid VAPID configuration');
    return false;
  }
}

/** Test hook: forget cached VAPID state. */
export function _resetVapidForTests(): void {
  vapidReady = false;
  vapidWarned = false;
}

export async function sendToSub(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: object,
  opts?: { sender?: typeof webpush.sendNotification },
): Promise<'sent' | 'gone' | 'error'> {
  try {
    if (!ensureVapid()) return 'error';
    const sender = opts?.sender ?? webpush.sendNotification.bind(webpush);
    await sender(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      JSON.stringify(payload),
      { TTL: 6 * 60 * 60, urgency: 'normal', timeout: 10_000 },
    );
    return 'sent';
  } catch (e) {
    const err = e as { statusCode?: unknown; name?: unknown } | null;
    const status = err?.statusCode;
    if (status === 404 || status === 410) return 'gone';
    const tag = typeof status === 'number' ? `status ${status}` : typeof err?.name === 'string' ? err.name : 'unknown';
    console.warn(`Push send failed: ${tag}`);
    return 'error';
  }
}
