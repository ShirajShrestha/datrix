import { describe, it, expect } from 'vitest';
import { safeDecode } from '../safeDecode';

describe('safeDecode', () => {
  it('decodes valid input', () => {
    expect(safeDecode('a%20b')).toBe('a b');
    expect(safeDecode('ai')).toBe('ai');
  });
  it('returns raw string for malformed input and never throws', () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A');
    expect(() => safeDecode('%')).not.toThrow();
  });
});
