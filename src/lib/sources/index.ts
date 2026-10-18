import type { RawArticle } from './types';
import { fetchRss } from './rss';
import { fetchGuardian } from './guardian';
import { fetchGNews } from './gnews';
import { fetchMediaStack } from './mediastack';

export async function fetchAllSources(): Promise<{ articles: RawArticle[]; failures: string[] }> {
  const adapters: Array<[string, () => Promise<RawArticle[]>]> = [
    ['rss', fetchRss],
    ['guardian', fetchGuardian],
    ['gnews', fetchGNews],
    ['mediastack', fetchMediaStack],
  ];
  const settled = await Promise.allSettled(adapters.map(([, fn]) => fn()));
  const articles: RawArticle[] = [];
  const failures: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') articles.push(...r.value);
    else {
      failures.push(adapters[i][0]);
      console.warn(`[sources] ${adapters[i][0]} failed`);
    }
  });
  return { articles, failures };
}
