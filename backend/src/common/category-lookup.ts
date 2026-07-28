import { FindOptionsWhere, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';

/**
 * Categories are keyed by (navigation, slug): the same collection can be listed under more
 * than one heading, so a slug on its own no longer identifies a row.
 *
 * Callers that know which heading the user came from pass it and get that heading's row.
 * Callers that do not — the legacy scrape route, a bookmarked URL — fall back to the
 * lowest-id match, which is the first heading the menu listed the collection under.
 */
export function categoryWhere(
  slug: string,
  navigationSlug?: string | null,
): FindOptionsWhere<Category> {
  return navigationSlug ? { slug, navigation: { slug: navigationSlug } } : { slug };
}

/** Finds one category, scoped to a navigation heading when the caller knows it. */
export function findCategory(
  repo: Repository<Category>,
  slug: string,
  navigationSlug?: string | null,
  relations: string[] = [],
): Promise<Category | null> {
  return repo.findOne({
    where: categoryWhere(slug, navigationSlug),
    relations,
    // Deterministic when the slug is ambiguous: oldest row wins rather than whatever
    // Postgres returns first.
    order: { id: 'ASC' },
  });
}
