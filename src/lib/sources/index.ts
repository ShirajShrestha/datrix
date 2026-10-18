import type { RawArticle } from './types';
import { fetchRss } from './rss';
import { fetchGuardian } from './guardian';
import { fetchGNews } from './gnews';
import { fetchMediaStack } from './mediastack';

export const FETCH_DEADLINE_MS = 35_000;

type Adapter = [string, () => Promise<RawArticle[]>];

/**
 * Fetch every adapter in parallel against one shared deadline. An adapter that has not settled when
 * the deadline passes contributes no articles and adds `timeout:<name>` to `failures`; adapters that
 * finished keep their articles. A rejecting adapter adds its bare name. Late settlements are swallowed.
 */
export async function fetchAllSources(
  opts: { deadlineMs?: number; adapters?: Adapter[] } = {},
): Promise<{ articles: RawArticle[]; failures: string[] }> {
  const deadlineMs = Math.max(0, opts.deadlineMs ?? FETCH_DEADLINE_MS);
  const adapters: Adapter[] = opts.adapters ?? [
    ['rss', fetchRss],
    ['guardian', fetchGuardian],
    ['gnews', fetchGNews],
    ['mediastack', fetchMediaStack],
  ];

  type Outcome = { kind: 'ok'; value: RawArticle[] } | { kind: 'fail' } | { kind: 'timeout' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), deadlineMs); });

  const outcomes: Outcome[] = await Promise.all(
    adapters.map(([, fn]) => {
      // Promise.resolve().then also converts a synchronous throw into a rejection.
      const run: Promise<Outcome> = Promise.resolve()
        .then(fn)
        .then((value): Outcome => ({ kind: 'ok', value }), (): Outcome => ({ kind: 'fail' }));
      return Promise.race([run, deadline.then((): Outcome => ({ kind: 'timeout' }))]);
    }),
  );
  if (timer) clearTimeout(timer);

  const articles: RawArticle[] = [];
  const failures: string[] = [];
  outcomes.forEach((o, i) => {
    const name = adapters[i][0];
    if (o.kind === 'ok') articles.push(...o.value);
    else if (o.kind === 'timeout') {
      failures.push(`timeout:${name}`);
      console.warn(`[sources] ${name} timed out`);
    } else {
      failures.push(name);
      console.warn(`[sources] ${name} failed`);
    }
  });
  return { articles, failures };
}
