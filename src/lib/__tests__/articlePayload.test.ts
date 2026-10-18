import { describe, it, expect } from 'vitest';
import { toArticleDTO } from '../articlePayload';

const base = { _id: 'abc', title: 't', url: 'https://x', source: 'S', categories: ['tech'], publishedAt: new Date(), importanceScore: 3 };

describe('toArticleDTO', () => {
  it('strips snippets from sources', () => {
    const dto = toArticleDTO({ ...base, sources: [{ name: 'A', url: 'https://a', snippet: 'secret' }] });
    expect(dto.sources).toEqual([{ name: 'A', url: 'https://a' }]);
    expect(JSON.stringify(dto)).not.toContain('secret');
  });
  it('defaults images and tolerates missing fields', () => {
    const dto = toArticleDTO(base);
    expect(dto.images).toEqual([]);
    expect(dto.sources).toEqual([]);
    expect(dto.description).toBeUndefined();
    expect(dto.brief).toBeUndefined();
  });
  it('maps brief without generatedAt', () => {
    const dto = toArticleDTO({ ...base, description: 'd', images: ['i'], brief: { whatHappened: 'w', provider: 'groq', generatedAt: new Date() } });
    expect(dto.brief).toEqual({ whatHappened: 'w', whyItMatters: undefined, background: undefined, provider: 'groq' });
    expect(dto.images).toEqual(['i']);
    expect(dto.description).toBe('d');
  });
});
