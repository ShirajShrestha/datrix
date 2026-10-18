import { MissingKeyError, ProviderHttpError, DEFAULT_TIMEOUT_MS, SYSTEM_PROMPT, buildUserPrompt, parseSummaries, type SummaryProvider } from './parse';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_DEFAULT_MODEL = 'llama-3.1-8b-instant';

export const groqProvider: SummaryProvider = async (batch, opts) => {
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(batch) },
      ],
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderHttpError('groq', res.status);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = data?.choices?.[0]?.message?.content;
  return parseSummaries(typeof content === 'string' ? content : '', batch);
};
