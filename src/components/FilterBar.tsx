'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';

export type Category = 'all' | 'ai' | 'tech' | 'economy' | 'world';
export type Importance = 'all' | 'high' | 'medium';

interface FilterBarProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: Category) => void;
  onImportanceChange: (importance: Importance) => void;
  selectedCategory: Category;
  selectedImportance: Importance;
}

const categories: { value: Category; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'var(--text-muted)' },
  { value: 'ai', label: 'AI', color: 'var(--accent-ai)' },
  { value: 'tech', label: 'Tech', color: 'var(--accent-tech)' },
  { value: 'economy', label: 'Economy', color: 'var(--accent-economy)' },
  { value: 'world', label: 'World', color: 'var(--accent-world)' },
];

const importanceLevels: { value: Importance; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'var(--text-muted)' },
  { value: 'high', label: 'High', color: 'var(--accent-high)' },
  { value: 'medium', label: 'Medium', color: 'var(--accent-medium)' },
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
    <header 
      className="sticky top-0 z-50 flex items-center justify-between px-6"
      style={{ 
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        height: 56,
      }}
    >
      <div style={{ width: 240 }} className="hidden lg:block" />

      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full max-w-[520px]" style={{ width: 'min(520px, 60%)' }}>
          <Search 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-highlight)',
              borderRadius: 8,
              padding: '0 16px 0 40px',
              fontSize: 14,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-highlight)',
            borderRadius: 8,
            color: showFilters ? 'var(--accent-brand)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {showFilters && (
        <div 
          className="absolute top-full left-0 right-0 px-6 py-4 border-b border-[var(--border)]"
          style={{ 
            background: 'var(--bg-base)',
          }}
        >
          <div className="flex flex-wrap gap-6 max-w-5xl mx-auto">
            <div>
              <label 
                className="block text-[10px] font-medium mb-2.5"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              >
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => onCategoryChange(cat.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      fontFamily: 'var(--font-sans)',
                      background: selectedCategory === cat.value ? 'var(--accent-brand)' : 'var(--bg-elevated)',
                      color: selectedCategory === cat.value ? '#ffffff' : 'var(--text-muted)',
                      border: selectedCategory === cat.value ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label 
                className="block text-[10px] font-medium mb-2.5"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              >
                Importance
              </label>
              <div className="flex flex-wrap gap-2">
                {importanceLevels.map((imp) => (
                  <button
                    key={imp.value}
                    onClick={() => onImportanceChange(imp.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      fontFamily: 'var(--font-sans)',
                      background: selectedImportance === imp.value ? 'var(--text-primary)' : 'var(--bg-elevated)',
                      color: selectedImportance === imp.value ? 'var(--bg-base)' : 'var(--text-muted)',
                      border: selectedImportance === imp.value ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {imp.value !== 'all' && (
                      <span 
                        style={{ 
                          width: 6, 
                          height: 6, 
                          borderRadius: '50%', 
                          backgroundColor: imp.color 
                        }} 
                      />
                    )}
                    {imp.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  alignSelf: 'flex-end',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        .search-input:focus {
          border-color: var(--accent-brand) !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
          outline: none !important;
        }
        .search-input::placeholder {
          color: var(--text-muted);
        }
      `}</style>
    </header>
  );
}
