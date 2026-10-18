import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { buildArticleQuery } from '@/lib/articleQuery';
import { toArticleDTO } from '@/lib/articlePayload';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { filter, sort, limit } = buildArticleQuery(request.nextUrl.searchParams);

  try {
    await connectToDatabase();
    const docs = await Article.find(filter).sort(sort).limit(limit).lean();

    const articles = docs.map((a) => toArticleDTO(a));

    return NextResponse.json(
      { success: true, count: articles.length, articles },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    console.error('Articles fetch failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}
