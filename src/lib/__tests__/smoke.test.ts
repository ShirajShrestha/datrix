import { describe, it, expect } from 'vitest';
import connectToDatabase from '@/lib/db';

describe('test tooling', () => {
  it('imports alias', () => {
    expect(typeof connectToDatabase).toBe('function');
  });
});
