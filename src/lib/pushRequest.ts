import { NextRequest, NextResponse } from 'next/server';

export const MAX_BODY_BYTES = 8 * 1024;

const err = (message: string, status: number) => NextResponse.json({ success: false, error: message }, { status });

/**
 * Origin must match the request host. With `requireOrigin` (the browser-only POST routes) a missing
 * Origin is rejected too: browsers always send Origin on POST fetches, so only non-browser clients omit it.
 * Cron routes (called by GitHub Actions, no Origin) do not use this.
 */
export function sameOrigin(request: NextRequest, opts: { requireOrigin?: boolean } = {}): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return !opts.requireOrigin;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Origin check (required by default for these browser-only routes) + size-capped JSON body parse. Returns the body or an error response. */
export async function readJsonBody(
  request: NextRequest,
  opts: { requireOrigin?: boolean } = {},
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  if (!sameOrigin(request, { requireOrigin: opts.requireOrigin ?? true })) return { ok: false, response: err('Forbidden', 403) };
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, response: err('Payload too large', 413) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: err('Invalid body', 400) };
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: err('Payload too large', 413) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: err('Invalid JSON', 400) };
  }
}

export function endpointFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const e = (body as { endpoint?: unknown }).endpoint;
  return typeof e === 'string' && e.length > 0 && e.length <= 1000 && e.startsWith('https://') ? e : null;
}

export { err as jsonError };
