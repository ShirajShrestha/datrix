import { CATEGORIES } from '@/lib/categories';

export type Scope = 'global' | 'local';
export const LOCAL_SLUG = 'nepal';

export function parseScope(v: unknown): Scope {
  return v === 'local' ? 'local' : 'global';
}

export function scopeCategories(scope: Scope, chosen: readonly string[]): string[] {
  if (scope === 'local') return [LOCAL_SLUG];
  const rest = chosen.filter((s) => s !== LOCAL_SLUG);
  return rest.length > 0 ? rest : CATEGORIES.map((c) => c.slug).filter((s) => s !== LOCAL_SLUG);
}
