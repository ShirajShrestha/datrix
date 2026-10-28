import { describe, it, expect } from 'vitest';
import { CATEGORIES } from '@/lib/categories';
import { scopeCategories, parseScope } from '@/lib/scope';

describe('scopeCategories', () => {
  it('local returns only nepal', () => {
    expect(scopeCategories('local', ['ai', 'world'])).toEqual(['nepal']);
  });
  it('global drops nepal from chosen', () => {
    expect(scopeCategories('global', ['ai', 'nepal', 'world'])).toEqual(['ai', 'world']);
  });
  it('global falls back to every non-nepal slug', () => {
    const r = scopeCategories('global', ['nepal']);
    expect(r).toEqual(CATEGORIES.map((c) => c.slug).filter((s) => s !== 'nepal'));
    expect(r).toHaveLength(14);
  });
});

describe('parseScope', () => {
  it('parses', () => {
    expect(parseScope('local')).toBe('local');
    expect(parseScope('x')).toBe('global');
    expect(parseScope(undefined)).toBe('global');
  });
});
