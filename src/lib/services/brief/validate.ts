import type { Brief, BriefInput } from './index';

export const MIN_SNIPPET_CHARS = 200;
const LIMITS = { whatHappened: 90, whyItMatters: 50, background: 60 } as const;

/** Same per-snippet cap the prompt applies, so checks see exactly what the model sees. */
const MAX_SNIPPET = 600;
const seenText = (s: { text: string }): string => s.text.slice(0, MAX_SNIPPET);

export function hasEnoughText(input: BriefInput): boolean {
  return input.snippets.reduce((n, s) => n + seenText(s).length, 0) >= MIN_SNIPPET_CHARS;
}

function clean(s: string): string {
  return s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncates to maxWords, preferring a sentence end, else a word boundary with an ellipsis. */
function limitWords(s: string, maxWords: number): string {
  const words = s.split(' ');
  if (words.length <= maxWords) return s;
  const cut = words.slice(0, maxWords).join(' ');
  const sentence = cut.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentence && sentence[0].split(' ').length >= maxWords / 2) return sentence[0];
  return cut.replace(/[,;:\s]+$/, '') + '…';
}

const numbersIn = (s: string): string[] =>
  (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, ''));

/**
 * Shape and limits are the contract, not content: a well-formed output that is
 * unsupported by the snippets passes. The number guard is the only factual check.
 */
export function validateBrief(raw: unknown, input: BriefInput): Omit<Brief, 'provider'> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.whatHappened !== 'string') return null;
  const whatHappened = limitWords(clean(o.whatHappened), LIMITS.whatHappened);
  if (!whatHappened) return null;
  const out: Omit<Brief, 'provider'> = { whatHappened };
  for (const k of ['whyItMatters', 'background'] as const) {
    if (typeof o[k] !== 'string') continue;
    const v = limitWords(clean(o[k] as string), LIMITS[k]);
    if (v) out[k] = v;
  }
  const allowed = new Set(numbersIn([input.title, ...input.snippets.map(seenText)].join(' ')));
  const produced = numbersIn([out.whatHappened, out.whyItMatters ?? '', out.background ?? ''].join(' '));
  if (produced.some((n) => !allowed.has(n))) return null;
  return out;
}
