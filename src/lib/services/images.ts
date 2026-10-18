// og:image fallback for articles that arrive without an image.

const MAX_BYTES = 200 * 1024;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? '') : null;
}

const PRIORITY = ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'];

export function extractOgImage(html: string, baseUrl: string): string | null {
  const found = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase();
    const content = attr(tag, 'content');
    if (!key || !content || !PRIORITY.includes(key) || found.has(key)) continue;
    found.set(key, content);
  }
  for (const key of PRIORITY) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const u = new URL(decodeEntities(raw), baseUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, buf.length - off);
    buf.set(part, off);
    off += part.length;
    if (off >= buf.length) break;
  }
  return new TextDecoder('utf-8').decode(buf);
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return 'invalid-url'; }
}

async function fetchOgImage(url: string, timeoutMs: number, fetchImpl: FetchImpl): Promise<string | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  // Race guards against fetch implementations that ignore the abort signal.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  const work = (async () => {
    try {
      const res = await fetchImpl(url, {
        signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Datrix/1.0', Accept: 'text/html,application/xhtml+xml' },
      });
      if (!res.ok) {
        res.body?.cancel().catch(() => {});
        return null;
      }
      const html = await readCapped(res);
      return extractOgImage(html, res.url || url);
    } catch {
      console.warn(`[images] fetch failed for ${hostOf(url)}`);
      return null;
    }
  })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function resolveImages<T extends { url: string; imageUrl?: string }>(
  items: T[],
  opts: { max?: number; concurrency?: number; timeoutMs?: number; fetchImpl?: FetchImpl } = {},
): Promise<T[]> {
  const max = opts.max ?? 60;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const timeoutMs = opts.timeoutMs ?? 4000;
  const fetchImpl: FetchImpl = opts.fetchImpl ?? ((u, init) => fetch(u, init));

  const out = items.slice();
  const targets: number[] = [];
  for (let i = 0; i < items.length && targets.length < max; i++) {
    if (!items[i].imageUrl) targets.push(i);
  }
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const idx = targets[next++];
      try {
        const img = await fetchOgImage(items[idx].url, timeoutMs, fetchImpl);
        if (img) out[idx] = { ...items[idx], imageUrl: img };
      } catch {
        /* leave unchanged */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return out;
}
