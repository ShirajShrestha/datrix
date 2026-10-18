'use client';

import { Check } from 'lucide-react';
import { CATEGORIES, type CategorySlug } from '@/lib/categories';
import { ALL_CATEGORY_SLUGS, toggleCategory } from '@/lib/categoryPicker';

interface Props {
  selected: readonly CategorySlug[];
  onChange: (next: CategorySlug[]) => void;
}

const linkBtn: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  color: 'var(--accent-brand)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 0',
};

export default function CategoryPicker({ selected, onChange }: Props) {
  const set = new Set(selected);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {selected.length} of {CATEGORIES.length} selected
        </span>
        <div className="flex gap-4">
          <button type="button" style={linkBtn} onClick={() => onChange([...ALL_CATEGORY_SLUGS])}>
            Select all
          </button>
          <button type="button" style={linkBtn} onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Categories">
        {CATEGORIES.map((c) => {
          const on = set.has(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={on}
              data-category={c.slug}
              onClick={() => onChange(toggleCategory(selected, c.slug))}
              className="flex items-start gap-3 text-left rounded-lg"
              style={{
                padding: '10px 12px',
                background: on ? 'var(--bg-elevated)' : 'transparent',
                border: `1px solid ${on ? c.color : 'var(--border-highlight)'}`,
                borderLeft: `3px solid ${c.color}`,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-primary)',
              }}
            >
              <span aria-hidden style={{ fontSize: 20, lineHeight: '24px' }}>{c.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</span>
                <span className="block" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {c.description}
                </span>
              </span>
              <span
                aria-hidden
                className="flex items-center justify-center shrink-0 rounded"
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 3,
                  background: on ? c.color : 'transparent',
                  border: `1px solid ${on ? c.color : 'var(--border-highlight)'}`,
                  color: '#fff',
                }}
              >
                {on && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
