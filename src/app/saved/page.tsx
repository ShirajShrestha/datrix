'use client';

import { useSyncExternalStore } from 'react';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import { NewsGridSkeleton } from '@/components/Skeletons';
import { Bookmark } from 'lucide-react';

const SAVED_ARTICLES_KEY = 'newsintel_saved_articles';

function useLocalStorageStore<T>(key: string, initialValue: T) {
  const getValue = () => {
    if (typeof window === 'undefined') return initialValue;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  };

  return useSyncExternalStore(
    () => () => {},
    getValue,
    () => initialValue
  );
}

export default function SavedPage() {
  const articles = useLocalStorageStore<NewsArticle[]>(SAVED_ARTICLES_KEY, []);
  
  const loading = useSyncExternalStore(
    () => () => {},
    () => false,
    () => true
  );

  const handleSave = (article: NewsArticle) => {
    const saved = localStorage.getItem(SAVED_ARTICLES_KEY);
    let currentSaved: NewsArticle[] = [];
    
    if (saved) {
      try {
        currentSaved = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved articles:', e);
      }
    }

    const exists = currentSaved.find(a => a._id === article._id);
    if (exists) {
      currentSaved = currentSaved.filter(a => a._id !== article._id);
    } else {
      currentSaved.push({ ...article, isSaved: true });
    }

    localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(currentSaved));
    window.location.reload();
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Bookmark className="w-6 h-6" />
            Saved Articles
          </h1>
          <p className="text-zinc-500 mt-1">
            {loading ? 'Loading...' : `${articles.length} saved articles`}
          </p>
        </div>

        {loading ? (
          <NewsGridSkeleton count={4} />
        ) : articles.length > 0 ? (
          <div className="grid gap-4">
            {articles.map((article: NewsArticle) => (
              <NewsCard key={article._id} article={article} onSave={handleSave} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No saved articles yet</p>
            <p className="text-sm text-zinc-600 mt-2">
              Tap the bookmark icon on any article to save it for later
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
