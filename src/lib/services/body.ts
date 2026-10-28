import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { toBody } from '@/lib/sources/rss';

const UA = 'Datrix/1.0 (+news reader)';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Readable article text from a page, or null when blocked/paywalled/too short. Never throws. */
export function extractReadableText(html: string, url: string): string | null {
  try {
    const { document } = parseHTML(html);
    // linkedom documents have no URL; Readability reads documentURI/baseURI to resolve links.
    try {
      Object.defineProperty(document, 'documentURI', { value: url, configurable: true });
    } catch {
      /* best effort */
    }
    const article = new Readability(document as unknown as Document).parse();
    // toBody(.., false) normalizes whitespace, returns undefined under MIN_BODY_CHARS, caps on a word boundary.
    return toBody(article?.textContent ?? undefined, false) ?? null;
  } catch {
    return null;
  }
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.includes(':')) {
    // IPv6: loopback, unspecified, unique-local, link-local, IPv4-mapped.
    return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
  }
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function allowed(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return isPrivateHost(url.hostname) ? null : url;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<string | null> {
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BYTES) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const PAYWALLED_HOSTS = ['nytimes.com', 'wsj.com', 'ft.com', 'bloomberg.com'];

/** True for hard-paywalled publishers (and their subdomains), whose pages yield no readable text. */
export function isPaywalledHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    return PAYWALLED_HOSTS.some((p) => h === p || h.endsWith(`.${p}`));
  } catch {
    return false;
  }
}

export async function fetchBody(url: string, opts: { timeoutMs?: number } = {}): Promise<string | null> {
  if (isPaywalledHost(url)) return null;
  try {
    const signal = AbortSignal.timeout(opts.timeoutMs ?? 8000);
    let current = allowed(url);
    // Redirects are followed by hand so every hop is re-checked against the private-host rules.
    for (let hop = 0; current && hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current.href, {
        signal,
        redirect: 'manual',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        current = loc ? allowed(new URL(loc, current).href) : null;
        continue;
      }
      if (!res.ok) return null;
      if (!(res.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) return null;
      const html = await readCapped(res);
      return html ? extractReadableText(html, current.href) : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveBodies(
  items: { url: string; body?: string }[],
  opts: {
    max: number;
    concurrency?: number;
    deadlineAt: number;
    now?: () => number;
    fetchBody?: (url: string) => Promise<string | null>;
  },
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = opts.now ?? Date.now;
  const fetcher = opts.fetchBody ?? fetchBody;
  const queue: string[] = [];
  for (const it of items) {
    if (it.body) out.set(it.url, it.body);
    else if (!out.has(it.url) && !queue.includes(it.url) && !isPaywalledHost(it.url)) queue.push(it.url);
  }
  const todo = queue.slice(0, Math.max(0, opts.max));
  let next = 0;
  const worker = async () => {
    while (next < todo.length && now() < opts.deadlineAt) {
      const url = todo[next++];
      try {
        const body = await fetcher(url);
        if (body) out.set(url, body);
      } catch {
        /* a failed fetch just means no body */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 6) }, worker));
  return out;
}
