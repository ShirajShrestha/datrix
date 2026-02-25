import { NextRequest, NextResponse } from 'next/server';
import { fetchAllNews } from '@/lib/services/newsFetcher';
import { scoreArticles, deduplicateArticles, filterHighImportance } from '@/lib/services/scoring';
import { categorizeArticle } from '@/lib/services/newsFetcher';
import { summarizeArticle } from '@/lib/services/summarizer';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Starting daily news fetch...');

    await connectToDatabase();

    const rawArticles = await fetchAllNews();
    console.log(`📰 Fetched ${rawArticles.length} raw articles`);

    const processedArticles = rawArticles.map(article => ({
      ...article,
      category: article.category || categorizeArticle(article.title, article.description || ''),
    }));

    const scoredArticles = scoreArticles(processedArticles);
    const uniqueArticles = deduplicateArticles(scoredArticles);
    const importantArticles = filterHighImportance(uniqueArticles);

    const articlesWithSummaries = await Promise.all(
      importantArticles.slice(0, 20).map(async (article) => {
        const summary = summarizeArticle(article);
        
        const existingArticle = await Article.findOne({ url: article.url });
        
        if (existingArticle) {
          await Article.findByIdAndUpdate(existingArticle._id, {
            importanceScore: article.importanceScore,
            summary: summary,
            publishedAt: article.publishedAt,
          });
          return { ...article, summary, action: 'updated' };
        } else {
          await Article.create({
            title: article.title,
            url: article.url,
            source: article.source,
            category: article.category,
            publishedAt: article.publishedAt,
            importanceScore: article.importanceScore,
            summary: summary,
          });
          return { ...article, summary, action: 'created' };
        }
      })
    );

    console.log(`✅ Daily news fetch complete. Processed ${articlesWithSummaries.length} articles`);

    return NextResponse.json({
      success: true,
      message: 'Daily news fetch completed',
      processed: articlesWithSummaries.length,
      articles: articlesWithSummaries.map(a => ({ title: a.title, action: a.action })),
    });
  } catch (error) {
    console.error('❌ Error in daily news cron:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
