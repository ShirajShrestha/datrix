import { describe, it, expect } from 'vitest';
import { pickDescription, sourceLine, galleryImages, uniqueSourceNames, resolveSlugs } from '../storyView';

describe('pickDescription', () => {
  const long = 'x'.repeat(40);
  it('uses description when >= 40 chars', () => {
    expect(pickDescription({ description: long, summary: { tldr: 'tl' } })).toBe(long);
  });
  it('falls back to tldr when description is short', () => {
    expect(pickDescription({ description: 'short', summary: { tldr: 'the tldr' } })).toBe('the tldr');
  });
  it('trims tldr and treats whitespace-only as empty', () => {
    expect(pickDescription({ summary: { tldr: '  hi  ' } })).toBe('hi');
    expect(pickDescription({ description: 'short', summary: { tldr: '   ' } })).toBe('');
  });
  it('returns empty string when nothing available', () => {
    expect(pickDescription({})).toBe('');
    expect(pickDescription({ summary: {} })).toBe('');
  });
});

describe('sourceLine', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `O${i}`, url: `https://o${i}.com` }));
  it('shows 4 and counts the rest', () => {
    const r = sourceLine(mk(7), 'O0');
    expect(r.shown).toHaveLength(4);
    expect(r.extra).toBe(3);
  });
  it('puts primary first', () => {
    expect(sourceLine(mk(5), 'O3').shown[0].name).toBe('O3');
  });
  it('dedupes by name', () => {
    const s = [...mk(2), { name: 'O0', url: 'https://dup.com' }];
    const r = sourceLine(s, 'O1');
    expect(r.shown.map((x) => x.name)).toEqual(['O1', 'O0']);
    expect(r.extra).toBe(0);
  });
  it('dedupes and matches primary case-insensitively, keeping first-seen name', () => {
    const s = [{ name: 'BBC', url: 'https://a' }, { name: ' Reuters ', url: 'https://b' }, { name: 'bbc ', url: 'https://c' }, { name: 'reuters', url: 'https://d' }];
    const r = sourceLine(s, 'REUTERS');
    expect(r.shown.map((x) => x.name)).toEqual(['Reuters', 'BBC']);
    expect(r.shown[1].url).toBe('https://a');
    expect(uniqueSourceNames(s, 'bbc')).toEqual(['BBC', 'Reuters']);
  });
  it('tolerates undefined', () => {
    expect(sourceLine(undefined as never, 'x')).toEqual({ shown: [], extra: 0 });
  });
});

describe('galleryImages', () => {
  it('hero first, deduped, http(s) only, capped at 5', () => {
    const r = galleryImages({
      imageUrl: 'https://a.com/hero.jpg',
      images: ['javascript:alert(1)', 'data:image/png;base64,AA', 'https://a.com/hero.jpg', ...[1, 2, 3, 4, 5, 6].map((i) => `https://a.com/${i}.jpg`)],
    });
    expect(r[0]).toBe('https://a.com/hero.jpg');
    expect(r).toHaveLength(5);
    expect(r.some((u) => !u.startsWith('http'))).toBe(false);
  });
  it('tolerates undefined', () => {
    expect(galleryImages({})).toEqual([]);
  });
});

describe('uniqueSourceNames / resolveSlugs', () => {
  it('returns full deduped list, primary first', () => {
    const src = ['A','B','A','C','D','E','F'].map((n) => ({ name: n, url: 'https://x.com' }));
    expect(uniqueSourceNames(src, 'C')).toEqual(['C','A','B','D','E','F']);
  });
  it('tolerates malformed categories', () => {
    expect(resolveSlugs({ categories: [null, 5, 'ai'], category: 'ai' })).toEqual(['ai']);
  });
});
