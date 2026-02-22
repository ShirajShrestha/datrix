import { NextResponse } from 'next/server';
import { fetchAllNews } from '@/lib/services/newsFetcher';
import { scoreArticles, deduplicateArticles, filterHighImportance } from '@/lib/services/scoring';
import { categorizeArticle } from '@/lib/services/newsFetcher';
import { summarizeArticle } from '@/lib/services/summarizer';

export async function GET() {
  try {
    const rawArticles = await fetchAllNews();

    const processedArticles = rawArticles.map(article => ({
      ...article,
      category: article.category || categorizeArticle(article.title, article.description || ''),
    }));

    const scoredArticles = scoreArticles(processedArticles);
    const uniqueArticles = deduplicateArticles(scoredArticles);
    const importantArticles = filterHighImportance(uniqueArticles);

    const articlesWithSummaries = await Promise.all(
      importantArticles.slice(0, 20).map(async (article) => {
        const summary = await summarizeArticle(article);
        return {
          ...article,
          summary,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: articlesWithSummaries.length,
      articles: articlesWithSummaries,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
