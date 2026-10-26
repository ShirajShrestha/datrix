import { describe, it, expect } from 'vitest';
import { buildFeedLayout, outletInitials, sixtySecondScript } from '@/lib/feedLayout';
import { extractFigure, extractQuote } from '@/lib/highlights';

describe('highlights', () => {
  it('finds money and percent figures in headlines only', () => {
    expect(extractFigure({ title: 'Manchester City owner’s £55m housing loan investigated' })).toBe('£55m');
    expect(extractFigure({ title: 'Inflation rises to 3.8 per cent in September' })).toBe('3.8%');
    expect(extractFigure({ title: 'Firm raises $1.2bn in new round' })).toBe('$1.2bn');
    expect(extractFigure({ title: 'Brighton beat Palace 5-0 in 2026 derby' })).toBeNull();
    expect(extractFigure({ title: 'Plain headline', description: 'costs £9m' })).toBeNull();
  });

  it('finds a quoted phrase of reasonable length', () => {
    expect(extractQuote({ title: 'x', description: 'He said any other candidate would be the “wrong Leader.”' })).toBeNull();
    expect(extractQuote({ title: 'x', description: 'He said “any other candidate would be the wrong leader” today.' }))
      .toBe('any other candidate would be the wrong leader');
    expect(extractQuote({ title: "Man Utd showed 'unity' in draw" })).toBeNull();
    expect(extractQuote({ title: 'My one feeling is shame' })).toBeNull();
    expect(extractQuote({ title: 'x', description: 'a key figure in “You Can See Everything.”' })).toBeNull();
  });
});

describe('feed layout', () => {
  const mk = (title: string, description?: string) => ({ title, description });
  it('splits lead, keep-up, quick hits and more', () => {
    const list = Array.from({ length: 20 }, (_, i) => mk(`Story ${i}`));
    const l = buildFeedLayout(list);
    expect(l.lead?.title).toBe('Story 0');
    expect(l.keepUp).toHaveLength(8);
    expect(l.quickHits).toHaveLength(6);
    expect(l.more).toHaveLength(5);
    expect(buildFeedLayout([]).lead).toBeNull();
  });

  it('mixes variants without repeating one back to back and caps them', () => {
    const list = [
      mk('lead'),
      mk('Loan of £55m probed'), mk('Deal worth $2bn agreed'), mk('Rates up 2%'),
      mk('a', 'She said “we will not back down on this”.'), mk('b', 'He said “this is a moment for the whole country”.'),
      mk('c', 'They said “nothing will change for a long time”.'),
    ];
    const items = buildFeedLayout(list).keepUp;
    expect(items.map((i) => i.variant)).toEqual(['figure', 'standard', 'figure', 'quote', 'standard', 'quote']);
    expect(items.map((i) => i.wide)).toEqual([false, true, false, false, true, false]);
    const odd = buildFeedLayout([mk('lead'), mk('Loan of £55m probed'), mk('plain')]).keepUp;
    expect(odd.map((i) => i.wide)).toEqual([true, true]);
  });

  it('builds the audio script and outlet initials', () => {
    expect(sixtySecondScript([{ title: 'A happened', summary: { tldr: 'Short.' } }, { title: 'B?' }]))
      .toBe('1. A happened. Short. 2. B?');
    expect(outletInitials('The Guardian')).toBe('GDN');
    expect(outletInitials('Financial Times')).toBe('FT');
    expect(outletInitials('Wired')).toBe('WIR');
  });
});

import { groupDigest } from '@/lib/digest';
describe('digest grouping', () => {
  it('takes the top stories, groups by primary topic and numbers in reading order', () => {
    const a = (id: string, s: number, cat: string) => ({ _id: id, importanceScore: s, categories: [cat] });
    const g = groupDigest([a('1', 0.9, 'world'), a('2', 0.8, 'sports'), a('3', 0.85, 'world'), a('4', 0.1, 'law')], 3);
    expect(g.map((x) => x.slug)).toEqual(['world', 'sports']);
    expect(g[0].items.map((i) => [i.n, i.article._id])).toEqual([[1, '1'], [2, '3']]);
    expect(g[1].items[0].n).toBe(3);
  });
});
