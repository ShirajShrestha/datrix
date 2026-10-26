'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import NewsCard, { type NewsArticle } from '@/components/NewsCard';
import PageHeader, { EmptyState, pageWrap } from '@/components/PageHeader';
import { buildFeedLayout } from '@/lib/feedLayout';
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
      <div style={pageWrap}>
        <EmptyState title="Topic not found" body="We don’t have a topic by that name." />
        <Link href="/" style={{ color: 'var(--accent)', textAlign: 'center' }}>Back to Today</Link>
      </div>
    );
  }

  const layout = buildFeedLayout(articles);
  const items = layout.lead ? [{ article: layout.lead, variant: 'standard' as const, wide: true }, ...layout.keepUp] : [];
  const rest = [...layout.quickHits, ...layout.more];

  return (
    <div style={pageWrap}>
      <PageHeader kicker="Topic" title={def.label} meta={loading ? ' ' : `${articles.length} stories · ${def.description}`} />
      {loading ? (
        <NewsGridSkeleton count={4} />
      ) : articles.length > 0 ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gridAutoFlow: 'row dense', gap: 14 }}>
          {items.map((it, i) => (
            <div key={it.article._id} style={{ gridColumn: it.wide ? '1 / -1' : undefined }}>
              <NewsCard
                article={it.article} variant={it.variant} rank={i + 1} queue={articles}
                figure={'figure' in it ? it.figure : undefined} quote={'quote' in it ? it.quote : undefined}
              />
            </div>
          ))}
          {rest.map((a) => (
            <div key={a._id} style={{ gridColumn: '1 / -1' }}>
              <NewsCard article={a} queue={articles} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No stories in this topic yet" body="Check back after the next refresh." />
      )}
    </div>
  );
}
