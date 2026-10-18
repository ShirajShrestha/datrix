import type { Prefs } from '@/lib/prefs';
import { effectiveCategories } from '@/lib/prefs';

export type PushStatus = 'ok' | 'denied' | 'unsupported' | 'needs-install' | 'error' | 'limit';

export interface SubscribeBody {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  categories: string[];
  time: string;
  timeZone: string;
}

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function detectPushSupport(env: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}): 'ok' | 'unsupported' | 'needs-install' {
  // iOS only exposes push to installed PWAs, so check install first.
  if (env.isIOS && !env.isStandalone) return 'needs-install';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  return 'ok';
}

export function buildSubscribeBody(
  sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  prefs: { categories: string[]; notifyTime: string },
  timeZone: string
): SubscribeBody | null {
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!sub?.endpoint || !p256dh || !auth) return null;
  return {
    subscription: { endpoint: sub.endpoint, keys: { p256dh, auth } },
    categories: prefs.categories,
    time: prefs.notifyTime,
    timeZone,
  };
}

export function statusFromResponse(httpStatus: number): PushStatus {
  if (httpStatus >= 200 && httpStatus < 300) return 'ok';
  if (httpStatus === 503) return 'limit';
  return 'error';
}

export function testResultFromResponse(httpStatus: number): 'sent' | 'cooldown' | 'gone' | 'error' {
  if (httpStatus >= 200 && httpStatus < 300) return 'sent';
  if (httpStatus === 429) return 'cooldown';
  if (httpStatus === 404 || httpStatus === 410) return 'gone';
  return 'error';
}

export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Browser-only environment probe. Safe on the server (reports everything unsupported). */
export function readPushEnv() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { hasServiceWorker: false, hasPushManager: false, hasNotification: false, isIOS: false, isStandalone: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  let isStandalone = false;
  try {
    isStandalone =
      (window.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    /* ignore */
  }
  return {
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIOS,
    isStandalone,
  };
}

export function getPushSupport() {
  return detectPushSupport(readPushEnv());
}

function vapidKey(): string | null {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!k) {
    console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications are disabled');
    return null;
  }
  return k;
}

async function getRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

function sameKey(existing: ArrayBuffer | null | undefined, key: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  if (a.length !== key.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== key[i]) return false;
  return true;
}

async function postJson(url: string, body: unknown): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function postSubscription(sub: PushSubscription, prefs: Prefs): Promise<PushStatus> {
  const body = buildSubscribeBody(
    sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } },
    { categories: effectiveCategories(prefs), notifyTime: prefs.notifyTime },
    currentTimeZone()
  );
  if (!body) return 'error';
  return statusFromResponse(await postJson('/api/push/subscribe', body));
}

async function ensureSubscription(reg: ServiceWorkerRegistration, key: Uint8Array): Promise<{ sub: PushSubscription; created: boolean }> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    if (sameKey(existing.options?.applicationServerKey, key)) return { sub: existing, created: false };
    await existing.unsubscribe();
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as unknown as BufferSource,
  });
  return { sub, created: true };
}

export async function enablePush(prefs: Prefs): Promise<PushStatus> {
  try {
    const support = getPushSupport();
    if (support !== 'ok') return support;
    const k = vapidKey();
    if (!k) return 'unsupported';

    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return 'denied';

    const reg = await getRegistration();
    if (!reg) return 'unsupported';

    const { sub, created } = await ensureSubscription(reg, urlBase64ToUint8Array(k));
    let status: PushStatus = 'error';
    try {
      status = await postSubscription(sub, prefs);
    } catch {
      status = 'error';
    }
    if (status !== 'ok') {
      // Roll back so the browser and server stay consistent.
      if (created) await sub.unsubscribe().catch(() => false);
    }
    return status;
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  try {
    if (getPushSupport() === 'unsupported' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await getRegistration(2000);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => false);
    await postJson('/api/push/unsubscribe', { endpoint }).catch(() => 0);
  } catch {
    /* swallow */
  }
}

export async function hasPushSubscription(): Promise<boolean> {
  try {
    if (getPushSupport() !== 'ok') return false;
    const reg = await getRegistration(2000);
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function syncPush(prefs: Prefs): Promise<PushStatus> {
  try {
    const support = getPushSupport();
    if (support !== 'ok') return support;
    if (Notification.permission !== 'granted') return 'denied';
    const reg = await getRegistration();
    if (!reg) return 'unsupported';
    const existing = await reg.pushManager.getSubscription();
    if (existing) return await postSubscription(existing, prefs);
    if (!prefs.notifyEnabled) return 'ok';
    const k = vapidKey();
    if (!k) return 'unsupported';
    // Permission is already granted, so this will not prompt.
    const { sub } = await ensureSubscription(reg, urlBase64ToUint8Array(k));
    const status = await postSubscription(sub, prefs).catch(() => 'error' as PushStatus);
    if (status !== 'ok') await sub.unsubscribe().catch(() => false);
    return status;
  } catch {
    return 'error';
  }
}

export async function sendTestPush(): Promise<'sent' | 'cooldown' | 'gone' | 'error'> {
  try {
    const reg = await getRegistration(2000);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return 'gone';
    const result = testResultFromResponse(await postJson('/api/push/test', { endpoint: sub.endpoint }));
    if (result === 'gone') await sub.unsubscribe().catch(() => false);
    return result;
  } catch {
    return 'error';
  }
}
