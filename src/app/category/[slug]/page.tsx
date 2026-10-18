'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import { safeDecode } from '@/lib/safeDecode';
import { getCategory, normalizeSlug } from '@/lib/categories';

export default function CategoryPage() {
  const params = useParams();
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string);
  const slug = normalizeSlug(safeDecode(rawSlug ?? ''));
  const def = slug ? getCategory(slug) : undefined;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/articles?categories=${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (!cancelled && data.success) setArticles(data.articles);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || !def) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Category not found</h1>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
            We don&apos;t have a category by that name.
          </p>
          <Link href="/" className="inline-block mt-4" style={{ color: 'var(--accent-brand)' }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">
            <span aria-hidden>{def.emoji}</span> {def.label}
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
