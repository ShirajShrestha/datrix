'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterBar, { Category, Importance } from '@/components/FilterBar';
import NewsCard, { NewsArticle } from '@/components/NewsCard';
import DigestPanel from '@/components/DigestPanel';
import { NewsGridSkeleton } from '@/components/Skeletons';

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedImportance, setSelectedImportance] = useState<Importance>('all');

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

  return (
    <div className="min-h-screen">
      <FilterBar
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        onImportanceChange={handleImportanceChange}
        selectedCategory={selectedCategory}
        selectedImportance={selectedImportance}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-zinc-100">
                {selectedCategory === 'all' ? 'Top Stories' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} News`}
              </h1>
              <span className="text-sm text-zinc-500">
                {loading ? 'Loading...' : `${filteredArticles.length} articles`}
              </span>
            </div>

            {loading ? (
              <NewsGridSkeleton count={6} />
            ) : filteredArticles.length > 0 ? (
              <div className="grid gap-4">
                {filteredArticles.map((article) => (
                  <NewsCard key={article._id} article={article} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-500">No articles found</p>
                <p className="text-sm text-zinc-600 mt-2">Try adjusting your filters</p>
              </div>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24">
              <DigestPanel articles={articles} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
