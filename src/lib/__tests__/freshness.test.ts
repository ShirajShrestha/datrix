import { describe, it, expect } from 'vitest';
import { isNewSince, safeImageUrl } from '../freshness';

describe('isNewSince', () => {
  const prev = Date.parse('2026-10-18T00:00:00Z');
  it('true when published after previous visit', () => {
    expect(isNewSince('2026-10-18T01:00:00Z', prev)).toBe(true);
    expect(isNewSince(new Date('2026-10-18T01:00:00Z'), prev)).toBe(true);
  });
  it('false when before', () => {
    expect(isNewSince('2026-10-17T23:00:00Z', prev)).toBe(false);
  });
  it('false when previousVisit null', () => {
    expect(isNewSince('2026-10-18T01:00:00Z', null)).toBe(false);
  });
  it('false for invalid date', () => {
    expect(isNewSince('garbage', prev)).toBe(false);
    expect(isNewSince(new Date('x'), prev)).toBe(false);
  });
  it('false when exactly equal', () => {
    expect(isNewSince(new Date(prev), prev)).toBe(false);
  });
});

describe('safeImageUrl', () => {
  it('accepts and trims http(s)', () => {
    expect(safeImageUrl('  https://a.com/i.jpg ')).toBe('https://a.com/i.jpg');
    expect(safeImageUrl('http://a.com/i.jpg')).toBe('http://a.com/i.jpg');
  });
  it('rejects unsafe or bad input', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('data:image/png;base64,AAA')).toBeNull();
    expect(safeImageUrl('')).toBeNull();
    expect(safeImageUrl('   ')).toBeNull();
    expect(safeImageUrl(42)).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
    expect(safeImageUrl('/img/a.jpg')).toBeNull();
    expect(safeImageUrl('//a.com/i.jpg')).toBeNull();
  });
  it('rejects over-long urls', () => {
    expect(safeImageUrl('https://a.com/' + 'x'.repeat(2000))).toBeNull();
  });
});
