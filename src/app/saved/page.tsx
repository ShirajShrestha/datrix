'use client';

import { Bookmark } from 'lucide-react';
import NewsCard, { type NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import PageHeader, { EmptyState, pageWrap } from '@/components/PageHeader';
import { useSavedArticles, toggleSavedStored } from '@/lib/savedArticles';
import { useHydrated } from '@/lib/useHydrated';

export default function SavedPage() {
  const articles = useSavedArticles<NewsArticle>();
  const hydrated = useHydrated();
  const list = [...articles].reverse();

  return (
    <div style={pageWrap}>
      <PageHeader kicker="Saved for later" title="Saved" meta={hydrated ? `${articles.length} ${articles.length === 1 ? 'story' : 'stories'} on this device` : ' '} />
      {!hydrated ? (
        <NewsGridSkeleton count={3} />
      ) : list.length > 0 ? (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {list.map((a) => <NewsCard key={a._id} article={a} onSave={toggleSavedStored} queue={list} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark className="w-10 h-10" aria-hidden />}
          title="Nothing saved yet"
          body="Tap the bookmark on any story to keep it here. Saved stories stay on this device."
        />
      )}
    </div>
  );
}
