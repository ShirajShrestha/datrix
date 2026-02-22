import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('📊 Generating daily digest...');

    await connectToDatabase();

    const topArticles = await Article.find({})
      .sort({ importanceScore: -1 })
      .limit(10)
      .lean();

    const digest = {
      date: new Date().toISOString(),
      articles: topArticles.map(a => ({
        title: a.title,
        source: a.source,
        category: a.category,
        importanceScore: a.importanceScore,
        summary: a.summary,
      })),
    };

    console.log(`✅ Daily digest generated with ${topArticles.length} articles`);

    return NextResponse.json({
      success: true,
      message: 'Daily digest generated',
      digest,
    });
  } catch (error) {
    console.error('❌ Error generating digest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate digest' },
      { status: 500 }
    );
  }
}
