import { MissingKeyError, ProviderHttpError, DEFAULT_TIMEOUT_MS, SYSTEM_PROMPT, buildUserPrompt, parseSummaries, type SummaryProvider } from './parse';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

export const geminiProvider: SummaryProvider = async (batch, opts) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new MissingKeyError('gemini');
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const res = await fetch(geminiUrl(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(batch) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderHttpError('gemini', res.status);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') ?? '';
  return parseSummaries(text, batch);
};
