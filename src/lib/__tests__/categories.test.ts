import { describe, it, expect } from 'vitest';
import { CATEGORIES, getCategory, normalizeSlug, tagCategories, GENERIC_KEYWORDS } from '../categories';

const ORDER = ['ai','technology','business','world','geopolitics','politics','law','science','health','environment','sports','entertainment','education','society','nepal'];

describe('nepal category', () => {
  it('is registered', () => {
    const c = getCategory('nepal')!;
    expect(c.label).toBe('Nepal');
    expect(c.emoji).toBe('🇳🇵');
    expect(c.weight).toBe(1.0);
    expect(c.guardianSections).toEqual([]);
  });
  it('tags nepal from a single specific keyword', () => {
    expect(tagCategories('world', 'Kathmandu protest turns violent')).toContain('nepal');
    expect(tagCategories('world', 'Nepalese climbers reach summit')).toContain('nepal');
  });
});

describe('category registry', () => {
  it('has 15 unique slugs in spec order', () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual(ORDER);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(15);
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
  it('matches whole words only (regression)', () => {
    expect(tagCategories('world', 'An important point')).toEqual(['world']);
    expect(tagCategories('world', 'Stockholm summit')).not.toContain('business');
    expect(tagCategories('world', 'Trademark and marketing news')).toEqual(['world']);
    expect(tagCategories('world', 'He said it was warm')).toEqual(['world']);
    expect(tagCategories('world', 'Plain headline here')).toEqual(['world']);
  });
  it('still matches inflections', () => {
    expect(tagCategories('world', 'Stocks fall as elections loom')).toEqual(['world', 'business', 'politics']);
    expect(tagCategories('world', 'Flooding hits town')).toContain('environment');
    expect(tagCategories('world', 'New AI model')).toContain('ai');
  });
  it('primary matching its own keywords is not duplicated', () => {
    const r = tagCategories('ai', 'AI and artificial intelligence');
    expect(r).toEqual(['ai']);
  });
  it('entertainment keeps its Guardian sections', () => {
    expect(getCategory('entertainment')?.guardianSections).toEqual(['culture', 'film', 'music', 'games', 'tv-and-radio']);
  });

  it('requires stronger evidence for secondary tags', () => {
    expect(tagCategories('world', 'Oil prices rise as vote nears')).toEqual(['world']);
    expect(tagCategories('world', 'New app lets cafes cut food waste')).toEqual(['world']);
    const r = tagCategories('world', 'Prime minister opens bank branch');
    expect(r).toContain('politics');
    expect(r).not.toContain('business');
  });
  it('exports generic keywords', () => {
    expect(GENERIC_KEYWORDS.has('oil')).toBe(true);
    expect(GENERIC_KEYWORDS.has('stock')).toBe(false);
  });

  it('normalizeSlug rejects prototype keys', () => {
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) expect(normalizeSlug(k)).toBeNull();
  });
});
