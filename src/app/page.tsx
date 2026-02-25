'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import FilterBar, { Category, Importance } from '@/components/FilterBar';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import DigestPanel from '@/components/DigestPanel';
import { NewsGridSkeleton } from '@/components/Skeletons';

const SAVED_ARTICLES_KEY = 'newsintel_saved_articles';
const ITEMS_PER_PAGE = 10;

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

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedImportance, setSelectedImportance] = useState<Importance>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const savedArticles = useLocalStorageStore<NewsArticle[]>(SAVED_ARTICLES_KEY, []);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedImportance !== 'all') params.set('importance', selectedImportance);

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setArticles(data.articles);
        setFilteredArticles(data.articles);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedImportance]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCategoryChange = useCallback((category: Category) => {
    setSelectedCategory(category);
  }, []);

  const handleImportanceChange = useCallback((importance: Importance) => {
    setSelectedImportance(importance);
  }, []);

  const handleSave = useCallback((article: NewsArticle) => {
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
  }, []);

  const isArticleSaved = useCallback((articleId: string) => {
    return savedArticles.some((a: NewsArticle) => a._id === articleId);
  }, [savedArticles]);

  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen">
      <FilterBar
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        onImportanceChange={handleImportanceChange}
        selectedCategory={selectedCategory}
        selectedImportance={selectedImportance}
      />

      <div className="flex">
        <div className="flex-1 min-w-0" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <style jsx>{`
            @media (max-width: 768px) {
              .content-area {
                padding-left: 16px !important;
                padding-right: 16px !important;
              }
            }
          `}</style>
          <div className="content-area">
            <div className="pt-6 pb-4">
              <div 
                className="flex items-center justify-between pb-4 border-b border-[var(--border)]"
              >
                <h1 
                  className="font-serif"
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedCategory === 'all' ? 'Top Stories' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`}
                </h1>
                <div className="flex items-center gap-3">
                  <span 
                    style={{ height: 20, width: 1, backgroundColor: 'var(--border)' }} 
                  />
                  <span 
                    className="tabular-nums"
                    style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
                  >
                    {loading ? '—' : `${filteredArticles.length} articles`}
                  </span>
                </div>
              </div>
            </div>

            {loading ? (
              <NewsGridSkeleton count={6} />
            ) : paginatedArticles.length > 0 ? (
              <>
                <div className="flex flex-col">
                  {paginatedArticles.map((article) => (
                    <NewsCard 
                      key={article._id} 
                      article={{ ...article, isSaved: isArticleSaved(article._id) }} 
                      onSave={handleSave}
                    />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      Previous
                    </button>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p style={{ color: 'var(--text-muted)' }}>No articles found</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', opacity: 0.6, marginTop: 8 }}>Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>

        <aside className="w-[320px] flex-shrink-0 hidden lg:block px-6 pt-6">
          <div className="sticky top-24">
            <DigestPanel articles={articles} />
          </div>
        </aside>
      </div>
    </div>
  );
}
