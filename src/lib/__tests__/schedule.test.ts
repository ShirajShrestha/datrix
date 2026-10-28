import { describe, it, expect } from 'vitest';
import { quotaSourcesFor } from '../sources/schedule';

const at = (h: number) => new Date(Date.UTC(2026, 9, 28, h, 20));

describe('quotaSourcesFor', () => {
  it('hour 0 enables both', () => expect(quotaSourcesFor(at(0))).toEqual({ gnews: true, mediastack: true }));
  it('hour 4 enables only gnews', () => expect(quotaSourcesFor(at(4))).toEqual({ gnews: true, mediastack: false }));
  it('hour 2 enables neither', () => expect(quotaSourcesFor(at(2))).toEqual({ gnews: false, mediastack: false }));
  it('hour 22 enables neither', () => expect(quotaSourcesFor(at(22))).toEqual({ gnews: false, mediastack: false }));
  it('INGEST_ALL_SOURCES=1 forces both', () => {
    expect(quotaSourcesFor(at(3), { INGEST_ALL_SOURCES: '1' })).toEqual({ gnews: true, mediastack: true });
  });
  it('other values do not force', () => {
    expect(quotaSourcesFor(at(3), { INGEST_ALL_SOURCES: 'true' })).toEqual({ gnews: false, mediastack: false });
    expect(quotaSourcesFor(at(3), {})).toEqual({ gnews: false, mediastack: false });
  });
});
