import { describe, it, expect } from 'vitest';
import { CATEGORIES, getCategory, normalizeSlug, tagCategories } from '../categories';

const ORDER = ['ai','technology','business','world','geopolitics','politics','law','science','health','environment','sports','entertainment','education','society'];

describe('category registry', () => {
  it('has 14 unique slugs in spec order', () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual(ORDER);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(14);
  });
  it('every category is complete', () => {
    for (const c of CATEGORIES) {
      expect(c.label).toBeTruthy();
      expect(c.emoji).toBeTruthy();
      expect(c.keywords.length).toBeGreaterThanOrEqual(1);
      expect(c.feeds.length + c.guardianSections.length).toBeGreaterThanOrEqual(1);
    }
  });
  it('getCategory finds by slug', () => {
    expect(getCategory('law')?.label).toBe('Law & Justice');
    expect(getCategory('nope')).toBeUndefined();
  });
  it('normalizeSlug maps legacy slugs', () => {
    expect(normalizeSlug('tech')).toBe('technology');
    expect(normalizeSlug('economy')).toBe('business');
    expect(normalizeSlug('World')).toBe('world');
    expect(normalizeSlug('bogus')).toBeNull();
  });
  it('tagCategories puts primary first and adds keyword hits', () => {
    expect(tagCategories('geopolitics', 'Sanctions hit oil exports')).toEqual(['geopolitics', 'business']);
  });
  it('tagCategories never duplicates the primary', () => {
    const r = tagCategories('business', 'Stock market rally on inflation data', 'markets and trade');
    expect(r[0]).toBe('business');
    expect(r.filter((s) => s === 'business')).toHaveLength(1);
  });
});
