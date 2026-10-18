'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';

export default function CategoryPage() {
  const params = useParams();
  const category = params.slug as string;
  
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/articles?categories=${category}`);
      const data = await response.json();
      
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const categoryNames: Record<string, string> = {
    ai: 'Artificial Intelligence',
    tech: 'Technology',
    economy: 'Economy',
    world: 'World',
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">
            {categoryNames[category] || category} News
          </h1>
          <p className="text-zinc-500 mt-1">
            {loading ? 'Loading...' : `${articles.length} articles`}
          </p>
        </div>

        {loading ? (
          <NewsGridSkeleton count={6} />
        ) : articles.length > 0 ? (
          <div className="grid gap-4">
            {articles.map((article) => (
              <NewsCard key={article._id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-500">No articles found in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
