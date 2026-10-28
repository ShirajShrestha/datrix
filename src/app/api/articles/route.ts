import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { buildArticleQuery, FRESH_MIN_RESULTS, FRESH_WIDEN_HOURS } from '@/lib/articleQuery';
import { toArticleDTO } from '@/lib/articlePayload';
import { rankArticles } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const now = Date.now();
  const { filter, sort, limit, freshHours } = buildArticleQuery(params, now);

  try {
    await connectToDatabase();
    let articles;
    if (freshHours === undefined) {
      const docs = await Article.find(filter).sort(sort).limit(limit).lean();
      articles = docs.map((a) => toArticleDTO(a));
    } else {
      // Fresh Today: over-fetch candidates, rerank by age decay, widen if the window is thin.
      let ranked = rankArticles((await Article.find(filter).sort(sort).limit(limit * 2).lean()).map((a) => toArticleDTO(a)), now);
      if (ranked.length < FRESH_MIN_RESULTS && freshHours < FRESH_WIDEN_HOURS) {
        const widened = new URLSearchParams(params);
        widened.set('fresh', String(FRESH_WIDEN_HOURS));
        const w = buildArticleQuery(widened, now);
        const wide = (await Article.find(w.filter).sort(w.sort).limit(limit * 2).lean()).map((a) => toArticleDTO(a));
        const seen = new Set(wide.map((a) => a._id));
        ranked = rankArticles([...wide, ...ranked.filter((a) => !seen.has(a._id))], now);
      }
      articles = ranked.slice(0, limit);
    }

    return NextResponse.json(
      { success: true, count: articles.length, articles },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Articles fetch failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}
