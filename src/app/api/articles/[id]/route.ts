import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { toArticleDTO } from '@/lib/articlePayload';

export const dynamic = 'force-dynamic';

const ID_RE = /^[a-f\d]{24}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  try {
    await connectToDatabase();
    const doc = await Article.findById(id).lean();
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json(
      { success: true, article: toArticleDTO(doc) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('Article fetch failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Failed to fetch article' }, { status: 500 });
  }
}
