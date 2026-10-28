'use client';

import { Check, Plus } from 'lucide-react';
import type { CategorySlug } from '@/lib/categories';
import { ALL_CATEGORY_SLUGS, SELECTABLE_CATEGORIES, toggleCategory } from '@/lib/categoryPicker';

interface Props {
  selected: readonly CategorySlug[];
  onChange: (next: CategorySlug[]) => void;
}

const linkBtn: React.CSSProperties = {
  fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', minHeight: 36,
};

export default function CategoryPicker({ selected, onChange }: Props) {
  const set = new Set(selected);
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {selected.length === 0 ? 'Nothing selected shows everything' : `${selected.length} of ${SELECTABLE_CATEGORIES.length} selected`}
        </span>
        <div className="flex gap-3">
          <button type="button" style={linkBtn} onClick={() => onChange([...ALL_CATEGORY_SLUGS])}>Select all</button>
          <button type="button" style={linkBtn} onClick={() => onChange([])}>Clear</button>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: 10 }} role="group" aria-label="Topics">
        {SELECTABLE_CATEGORIES.map((c) => {
          const on = set.has(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={on}
              data-category={c.slug}
              title={c.description}
              onClick={() => onChange(toggleCategory(selected, c.slug))}
              className="inline-flex items-center"
              style={{
                height: 44, padding: '0 16px 0 14px', gap: 8, borderRadius: 99, fontSize: 14, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-highlight)'}`,
                background: on ? 'var(--accent-soft)' : 'transparent',
                color: on ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {on ? <Check className="w-4 h-4" strokeWidth={2.4} aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
