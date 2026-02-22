'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);

  const fetchNews = useCallback(async (q: string) => {
    if (!q.trim()) {
      setArticles([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      
      if (data.success) {
        setArticles(data.articles);
      }
    } catch (error) {
      console.error('Error searching news:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchNews(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, fetchNews]);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100 mb-4">Search News</h1>
          <input
            type="text"
            placeholder="Search for topics, articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
          />
        </div>

        {loading ? (
          <NewsGridSkeleton count={6} />
        ) : searchQuery && articles.length > 0 ? (
          <div>
            <p className="text-sm text-zinc-500 mb-4">
              Found {articles.length} results for &quot;{searchQuery}&quot;
            </p>
            <div className="grid gap-4">
              {articles.map((article) => (
                <NewsCard key={article._id} article={article} />
              ))}
            </div>
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12">
            <p className="text-zinc-500">No results found for &quot;{searchQuery}&quot;</p>
            <p className="text-sm text-zinc-600 mt-2">Try different keywords</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-500">Enter a search term to find news</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><NewsGridSkeleton count={6} /></div>}>
      <SearchContent />
    </Suspense>
  );
}
