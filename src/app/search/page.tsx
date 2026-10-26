'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import NewsCard, { type NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import PageHeader, { EmptyState, pageWrap } from '@/components/PageHeader';
import { usePrefs, effectiveCategories } from '@/lib/prefs';
import { useHydrated } from '@/lib/useHydrated';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);

  const hydrated = useHydrated();
  const [prefs] = usePrefs();
  const chosenKey = effectiveCategories(prefs).join(',');
  const hasQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!hydrated || !hasQuery) return;
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/articles?q=${encodeURIComponent(searchQuery)}&categories=${encodeURIComponent(chosenKey)}`, { signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (data.success) setArticles(data.articles);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        console.error('Error searching news:', error);
      }
      if (!controller.signal.aborted) setLoading(false);
    }, 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [hydrated, chosenKey, searchQuery, hasQuery]);

  return (
    <div style={pageWrap}>
      <PageHeader title="Search">
        <label
          className="flex items-center"
          style={{ marginTop: 8, gap: 10, height: 52, padding: '0 16px', borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', color: 'var(--text-faint)' }}
        >
          <Search className="w-5 h-5" aria-hidden />
          <span className="sr-only">Search stories</span>
          <input
            type="search" autoFocus placeholder="Search stories, people, places…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: 16 }}
          />
        </label>
      </PageHeader>

      {hasQuery && loading ? (
        <NewsGridSkeleton count={4} />
      ) : hasQuery && articles.length > 0 ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{articles.length} {articles.length === 1 ? 'story' : 'stories'} for “{searchQuery}”</p>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {articles.map((a) => <NewsCard key={a._id} article={a} queue={articles} />)}
          </div>
        </>
      ) : hasQuery ? (
        <EmptyState title={`No stories for “${searchQuery}”`} body="Try a person, place or a shorter phrase." />
      ) : (
        <EmptyState icon={<Search className="w-10 h-10" aria-hidden />} title="Find a story" body="Search headlines and summaries across your topics." />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={pageWrap}><NewsGridSkeleton count={4} /></div>}>
      <SearchContent />
    </Suspense>
  );
}
