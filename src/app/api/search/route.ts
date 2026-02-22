import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Article } from '@/lib/models/Article';
import { fetchAllNews } from '@/lib/services/newsFetcher';
import { scoreArticles, deduplicateArticles, filterHighImportance } from '@/lib/services/scoring';
import { categorizeArticle } from '@/lib/services/newsFetcher';
import { summarizeArticle } from '@/lib/services/summarizer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.toLowerCase() || '';
  const category = searchParams.get('category') || '';
  const importance = searchParams.get('importance') || '';

  try {
    // Try MongoDB first
    try {
      await connectToDatabase();
      const dbArticles = await Article.find({})
        .sort({ importanceScore: -1, publishedAt: -1 })
        .limit(50)
        .lean();

      if (dbArticles.length > 0) {
        let results = dbArticles.map(article => ({
          _id: article._id.toString(),
          title: article.title,
          url: article.url,
          source: article.source,
          category: article.category,
          publishedAt: article.publishedAt,
          importanceScore: article.importanceScore,
          summary: article.summary,
        }));

        if (query) {
          results = results.filter(a => 
            a.title.toLowerCase().includes(query) || 
            a.summary?.tldr?.toLowerCase().includes(query)
          );
        }

        if (category && category !== 'all') {
          results = results.filter(a => a.category === category);
        }

        if (importance && importance !== 'all') {
          if (importance === 'high') {
            results = results.filter(a => (a.importanceScore || 0) >= 0.75);
          } else if (importance === 'medium') {
            results = results.filter(a => (a.importanceScore || 0) >= 0.5 && (a.importanceScore || 0) < 0.75);
          }
        }

    results.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));

        return NextResponse.json({
          success: true,
          source: 'database',
          count: results.length,
          articles: results,
        });
      }
    } catch (dbError) {
      console.log('Database not available, fetching live news');
    }

    // Fallback: Fetch live news
    const rawArticles = await fetchAllNews();
    const processedArticles = rawArticles.map(article => ({
      ...article,
      category: article.category || categorizeArticle(article.title, article.description || ''),
    }));

    const scoredArticles = scoreArticles(processedArticles);
    const uniqueArticles = deduplicateArticles(scoredArticles);
    const importantArticles = filterHighImportance(uniqueArticles);

    const articlesWithSummaries = importantArticles.slice(0, 20).map((article) => {
      const summary = summarizeArticle(article);
      return {
        _id: article.url,
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        publishedAt: article.publishedAt,
        importanceScore: article.importanceScore,
        summary,
      };
    });

    let results = articlesWithSummaries;

    if (query) {
      results = results.filter(a => 
        a.title.toLowerCase().includes(query) || 
        a.summary?.tldr?.toLowerCase().includes(query)
      );
    }

    if (category && category !== 'all') {
      results = results.filter(a => a.category === category);
    }

    if (importance && importance !== 'all') {
      if (importance === 'high') {
        results = results.filter(a => (a.importanceScore || 0) >= 0.75);
      } else if (importance === 'medium') {
        results = results.filter(a => (a.importanceScore || 0) >= 0.5 && (a.importanceScore || 0) < 0.75);
      }
    }

    results.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));

    return NextResponse.json({
      success: true,
      source: 'live',
      count: results.length,
      articles: results,
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
