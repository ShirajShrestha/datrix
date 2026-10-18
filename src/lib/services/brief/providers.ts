import { MissingKeyError, ProviderHttpError, DEFAULT_TIMEOUT_MS } from '../summarizer/parse';
import { GROQ_URL, GROQ_DEFAULT_MODEL } from '../summarizer/groq';
import { GEMINI_DEFAULT_MODEL, geminiUrl } from '../summarizer/gemini';
import { BRIEF_SYSTEM_PROMPT, buildBriefPrompt } from './prompt';
import type { BriefProvider } from './index';

/** Returns the model's raw JSON text; the caller parses and validates it. */
export const groqBrief: BriefProvider = async (input, opts) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new MissingKeyError('groq');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: buildBriefPrompt(input) },
      ],
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderHttpError('groq', res.status);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
};

export const geminiBrief: BriefProvider = async (input, opts) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new MissingKeyError('gemini');
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const res = await fetch(geminiUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: BRIEF_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildBriefPrompt(input) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderHttpError('gemini', res.status);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
  return data?.candidates?.[0]?.content?.parts?.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') ?? '';
};
