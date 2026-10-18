import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { buildArticleQuery } from '@/lib/articleQuery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { filter, sort, limit } = buildArticleQuery(request.nextUrl.searchParams);

  try {
    await connectToDatabase();
    const docs = await Article.find(filter).sort(sort).limit(limit).lean();

    const articles = docs.map((a) => ({
      _id: String(a._id),
      title: a.title,
      url: a.url,
      source: a.source,
      // Transitional: derived single category for the legacy UI (removed in Tasks 13/14).
      category: a.categories?.[0],
      categories: a.categories ?? [],
      imageUrl: a.imageUrl,
      sources: a.sources ?? [],
      summary: a.summary,
      publishedAt: a.publishedAt,
      importanceScore: a.importanceScore,
    }));

    return NextResponse.json(
      { success: true, count: articles.length, articles },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Articles fetch failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}
