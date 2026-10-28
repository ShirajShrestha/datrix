import { extractiveSummary } from './extractive';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';
import {
  DEFAULT_TIMEOUT_MS, MissingKeyError, ProviderHttpError, parseSummaries,
  type ArticleSummary, type SummaryInput, type SummaryProvider, type SummaryProviderName,
} from './parse';

export { parseSummaries, extractiveSummary, groqProvider, geminiProvider, MissingKeyError, ProviderHttpError };
export type { ArticleSummary, SummaryInput, SummaryProvider, SummaryProviderName };

const GROUP_SIZE = 8;
export const GROUP_SIZE_WITH_BODY = 4;

export interface SummarizeOpts {
  deadlineAt?: number;
  now?: () => number;
  concurrency?: number;
  /** On a 429, sleep this long then retry that provider once for the group. Default 0 = mark dead immediately. */
  retry429Ms?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Minimum ms between the starts of two calls to the same provider (free-tier token pacing). Default 0 = none. */
  minGapMs?: number;
}

/** Provider label stored on summaries: explicit property, else groq/gemini by chain position. */
function labelOf(p: SummaryProvider, i: number): SummaryProviderName {
  const n = (p as { providerName?: SummaryProviderName }).providerName;
  return n ?? (i === 0 ? 'groq' : 'gemini');
}

/**
 * Summarize in order given (caller sorts by importance). Never throws. Items no provider covers get
 * extractive summaries. 429 marks a provider exhausted for the rest of the run; a missing key skips it.
 */
export async function summarizeBatch(
  items: SummaryInput[],
  providers: SummaryProvider[] = [groqProvider, geminiProvider],
  opts: SummarizeOpts = {},
): Promise<{ summaries: Map<string, ArticleSummary>; llmCalls: number; failures: string[] }> {
  const now = opts.now ?? Date.now;
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 3));
  const out = new Map<string, ArticleSummary>();
  const dead = new Set<number>();
  let llmCalls = 0;
  const failures = new Set<string>(); // coarse `summarizer:<provider>:<token>` only; never messages/URLs/keys

  const retry429Ms = opts.retry429Ms ?? 0;
  const minGapMs = Math.max(0, opts.minGapMs ?? 0);
  const lastStart = new Map<number, number>(); // provider index -> reserved start time of its latest call
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const size = items.some((i) => i.body) ? GROUP_SIZE_WITH_BODY : GROUP_SIZE;
  const groups: SummaryInput[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  const results: Map<string, ArticleSummary>[] = groups.map(() => new Map());

  async function doGroup(gi: number): Promise<void> {
    const batch = groups[gi];
    const got = results[gi];
    for (let pi = 0; pi < providers.length; pi++) {
      const missing = batch.filter((b) => !got.has(b.url));
      if (missing.length === 0) break;
      if (dead.has(pi)) continue;
      if ((opts.deadlineAt === undefined ? Infinity : opts.deadlineAt - now()) <= 0) break;
      const label = labelOf(providers[pi], pi);
      /** Returns false (without calling) when pacing would run past the deadline or the provider died meanwhile. */
      const attempt = async (): Promise<boolean> => {
        if (minGapMs > 0) {
          const t = now();
          const last = lastStart.get(pi);
          const startAt = last === undefined ? t : Math.max(t, last + minGapMs);
          if (opts.deadlineAt !== undefined && startAt >= opts.deadlineAt) return false;
          lastStart.set(pi, startAt); // reserve the slot synchronously so concurrent groups queue behind it
          if (startAt > t) await sleep(startAt - t);
          if (dead.has(pi)) return false;
        }
        const left = opts.deadlineAt === undefined ? Infinity : opts.deadlineAt - now();
        if (left <= 0) return false;
        const timeoutMs = Math.max(1, Math.min(DEFAULT_TIMEOUT_MS, left));
        llmCalls++;
        const res = await providers[pi](missing, { timeoutMs });
        const wanted = new Set(missing.map((m) => m.url));
        let usable = 0;
        for (const [url, s] of res) {
          if (wanted.has(url) && s && typeof s.tldr === 'string' && s.tldr) { got.set(url, { ...s, provider: label }); usable++; }
        }
        if (usable === 0) failures.add(`summarizer:${label}:parse`);
        return true;
      };
      let stop = false;
      let outOfTime = false;
      try {
        try {
          if (!(await attempt())) stop = true;
        } catch (e) {
          if (!(e instanceof ProviderHttpError && e.status === 429 && retry429Ms > 0)) throw e;
          await sleep(retry429Ms);
          // Another group may have exhausted this provider while we slept.
          if (dead.has(pi)) throw e;
          const leftAfter = opts.deadlineAt === undefined ? Infinity : opts.deadlineAt - now();
          if (leftAfter <= 0) {
            outOfTime = true;
            throw e;
          }
          if (!(await attempt())) {
            outOfTime = true;
            throw e;
          }
        }
      } catch (e) {
        if (e instanceof MissingKeyError) {
          llmCalls--;
          dead.add(pi);
        } else if (e instanceof ProviderHttpError) {
          failures.add(`summarizer:${label}:${Number.isInteger(e.status) ? e.status : 'error'}`);
          if (e.status === 429) dead.add(pi);
        } else {
          const name = (e as { name?: unknown } | null)?.name;
          failures.add(`summarizer:${label}:${name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error'}`);
        }
      }
      if (outOfTime || (stop && !dead.has(pi))) break;
    }
  }

  let next = 0;
  const worker = async () => {
    while (next < groups.length) {
      const gi = next++;
      try { await doGroup(gi); } catch { /* never throws */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, worker));

  for (let gi = 0; gi < groups.length; gi++) {
    for (const b of groups[gi]) {
      out.set(b.url, results[gi].get(b.url) ?? extractiveSummary(b));
    }
  }
  return { summaries: out, llmCalls, failures: [...failures] };
}
