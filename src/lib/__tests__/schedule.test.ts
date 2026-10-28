import { describe, it, expect } from 'vitest';
import { quotaSourcesFor } from '../sources/schedule';

const at = (h: number) => new Date(Date.UTC(2026, 9, 28, h, 20));

describe('quotaSourcesFor', () => {
  const both = { gnews: true, mediastack: true };
  const gnewsOnly = { gnews: true, mediastack: false };
  const none = { gnews: false, mediastack: false };
  it('hours 0 and 1 enable both', () => {
    expect(quotaSourcesFor(at(0))).toEqual(both);
    expect(quotaSourcesFor(at(1))).toEqual(both);
  });
  it('hour 2 enables neither', () => expect(quotaSourcesFor(at(2))).toEqual(none));
  it('hours 4 and 5 enable only gnews', () => {
    expect(quotaSourcesFor(at(4))).toEqual(gnewsOnly);
    expect(quotaSourcesFor(at(5))).toEqual(gnewsOnly);
  });
  it('hours 6, 7, 22 and 23 enable neither', () => {
    for (const h of [6, 7, 22, 23]) expect(quotaSourcesFor(at(h))).toEqual(none);
  });
  it('exactly one 2-hourly run per window: mediastack 1/day, gnews 6/day', () => {
    const runs = Array.from({ length: 12 }, (_, k) => quotaSourcesFor(at(k * 2)));
    expect(runs.filter((r) => r.mediastack)).toHaveLength(1);
    expect(runs.filter((r) => r.gnews)).toHaveLength(6);
  });
  it('INGEST_ALL_SOURCES=1 forces both', () => {
    expect(quotaSourcesFor(at(3), { INGEST_ALL_SOURCES: '1' })).toEqual({ gnews: true, mediastack: true });
  });
  it('other values do not force', () => {
    expect(quotaSourcesFor(at(3), { INGEST_ALL_SOURCES: 'true' })).toEqual({ gnews: false, mediastack: false });
    expect(quotaSourcesFor(at(3), {})).toEqual({ gnews: false, mediastack: false });
  });
});
