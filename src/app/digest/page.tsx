'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import { usePrefs, effectiveCategories } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';

export default function DigestPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const chosenKey = effectiveCategories(prefs).join(',');

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/articles?limit=50&categories=${encodeURIComponent(chosenKey)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted) return;

        if (data.success) {
          const sorted = data.articles
            .sort((a: NewsArticle, b: NewsArticle) => b.importanceScore - a.importanceScore)
            .slice(0, 10);
          setArticles(sorted);
        }
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        console.error('Error fetching digest:', error);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [hydrated, chosenKey]);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Daily Digest</h1>
          <p className="text-zinc-500">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <div className="mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl">
          <h2 className="text-sm font-medium text-orange-400 mb-1">Today&apos;s Top Stories</h2>
          <p className="text-xs text-zinc-400">
            The most important news, ranked by our AI-powered importance scoring engine.
          </p>
        </div>

        {loading ? (
          <NewsGridSkeleton count={5} />
        ) : articles.length > 0 ? (
          <div className="grid gap-4">
            {articles.map((article, idx) => (
              <div key={article._id} className="relative">
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-zinc-500 hidden lg:flex">
                  {idx + 1}
                </div>
                <NewsCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-500">No articles available</p>
          </div>
        )}
      </div>
    </div>
  );
}
