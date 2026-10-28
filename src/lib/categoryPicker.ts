import { CATEGORIES, type CategoryDef, type CategorySlug } from '@/lib/categories';
import { LOCAL_SLUG } from '@/lib/scope';

/** Add the slug if absent, remove it if present. Returns a new array in registry order. */
export function toggleCategory(selected: readonly CategorySlug[], slug: CategorySlug): CategorySlug[] {
  const set = new Set(selected);
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  return orderedSlugs(set);
}

/** Slugs in registry order, de-duplicated. */
export function orderedSlugs(slugs: Iterable<CategorySlug>): CategorySlug[] {
  const set = new Set(slugs);
  return CATEGORIES.filter((c) => set.has(c.slug)).map((c) => c.slug);
}

/** Registry definitions for the given slugs, in registry order. */
export function orderedCategories(slugs: readonly CategorySlug[]): CategoryDef[] {
  const set = new Set(slugs);
  return CATEGORIES.filter((c) => set.has(c.slug));
}

/** Categories a user can pick; Nepal is Local-scope only. */
export const SELECTABLE_CATEGORIES: CategoryDef[] = CATEGORIES.filter((c) => c.slug !== LOCAL_SLUG);

export const ALL_CATEGORY_SLUGS: CategorySlug[] = SELECTABLE_CATEGORIES.map((c) => c.slug);
