'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export type Category = 'all' | 'ai' | 'tech' | 'economy' | 'world';
export type Importance = 'all' | 'high' | 'medium';

interface FilterBarProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: Category) => void;
  onImportanceChange: (importance: Importance) => void;
  selectedCategory: Category;
  selectedImportance: Importance;
}

const categories: { value: Category; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📰' },
  { value: 'ai', label: 'AI', icon: '🤖' },
  { value: 'tech', label: 'Tech', icon: '💻' },
  { value: 'economy', label: 'Economy', icon: '📈' },
  { value: 'world', label: 'World', icon: '🌍' },
];

const importanceLevels: { value: Importance; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-zinc-700' },
  { value: 'high', label: 'High', color: 'bg-red-500' },
  { value: 'medium', label: 'Medium', color: 'bg-orange-500' },
];

export default function FilterBar({
  onSearch,
  onCategoryChange,
  onImportanceChange,
  selectedCategory,
  selectedImportance,
}: FilterBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, onSearch]);

  const clearFilters = () => {
    setSearchQuery('');
    onCategoryChange('all');
    onImportanceChange('all');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedImportance !== 'all';

  return (
    <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-lg border transition-all ${
              showFilters 
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100' 
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => onCategoryChange(cat.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        selectedCategory === cat.value
                          ? 'bg-zinc-100 text-zinc-900 font-medium'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  Importance
                </label>
                <div className="flex flex-wrap gap-2">
                  {importanceLevels.map((imp) => (
                    <button
                      key={imp.value}
                      onClick={() => onImportanceChange(imp.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 ${
                        selectedImportance === imp.value
                          ? 'bg-zinc-100 text-zinc-900 font-medium'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {imp.value !== 'all' && (
                        <span className={`w-2 h-2 rounded-full ${imp.color}`} />
                      )}
                      {imp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
