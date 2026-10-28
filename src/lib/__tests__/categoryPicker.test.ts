import { describe, it, expect } from 'vitest';
import { toggleCategory, orderedSlugs, orderedCategories, ALL_CATEGORY_SLUGS } from '../categoryPicker';

describe('categoryPicker helpers', () => {
  it('adds and removes, keeping registry order', () => {
    expect(toggleCategory(['world'], 'ai')).toEqual(['ai', 'world']);
    expect(toggleCategory(['ai', 'world'], 'ai')).toEqual(['world']);
    expect(toggleCategory([], 'society')).toEqual(['society']);
  });
  it('does not mutate input', () => {
    const input = ['ai'] as const;
    toggleCategory(input, 'world');
    expect(input).toEqual(['ai']);
  });
  it('orders and dedupes', () => {
    expect(orderedSlugs(['world', 'ai', 'world'])).toEqual(['ai', 'world']);
    expect(orderedCategories(['law', 'ai']).map((c) => c.slug)).toEqual(['ai', 'law']);
  });
  it('covers the 14 selectable categories and never nepal', () => {
    expect(ALL_CATEGORY_SLUGS).toHaveLength(14);
    expect(ALL_CATEGORY_SLUGS).not.toContain('nepal');
  });
});
