import { extractJson } from '../summarizer/parse';
import { hasEnoughText, validateBrief } from './validate';
import { groqBrief, geminiBrief } from './providers';

export { MIN_SNIPPET_CHARS, hasEnoughText, validateBrief } from './validate';
export { BRIEF_SYSTEM_PROMPT, buildBriefPrompt } from './prompt';

export interface BriefInput { title: string; snippets: { outlet: string; text: string }[] }
export interface Brief { whatHappened: string; whyItMatters?: string; background?: string; provider: 'groq' | 'gemini' }
/** Resolves to the model's raw JSON text (parsed by the caller). */
export type BriefProvider = (input: BriefInput, opts?: { timeoutMs?: number }) => Promise<unknown>;
export interface NamedBriefProvider { name: 'groq' | 'gemini'; call: BriefProvider }

const DEFAULT_PROVIDERS: NamedBriefProvider[] = [
  { name: 'groq', call: groqBrief },
  { name: 'gemini', call: geminiBrief },
];

/** Never throws: returns null on thin input, missing keys, or when every provider fails or is rejected. */
export async function generateBrief(
  input: BriefInput,
  providers: NamedBriefProvider[] = DEFAULT_PROVIDERS,
  opts?: { timeoutMs?: number },
): Promise<Brief | null> {
  if (!hasEnoughText(input)) return null;
  for (const p of providers) {
    try {
      const raw = await p.call(input, opts);
      const parsed = typeof raw === 'string' ? extractJson(raw) : raw;
      const brief = validateBrief(parsed, input);
      if (brief) return { ...brief, provider: p.name };
    } catch {
      /* skip this provider */
    }
  }
  return null;
}
