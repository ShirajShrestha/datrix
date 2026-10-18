import { CATEGORIES, type CategoryDef, type CategorySlug } from '@/lib/categories';

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

export const ALL_CATEGORY_SLUGS: CategorySlug[] = CATEGORIES.map((c) => c.slug);
