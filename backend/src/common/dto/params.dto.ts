import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * Shopify collection handles: lowercase alphanumerics joined by single hyphens.
 * Verified against all 113 scraped categories, e.g. `author-books-by-sarah-j-maas`,
 * `summer-reads-under-4`, `dvds-and-blu-ray`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A product's `source_id` is normally the numeric Shopify product id (`9794426798353`), but
 * the detail scraper falls back to the URL handle when the page does not expose one, so
 * handle-shaped values have to pass too.
 */
export const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class SlugParamDto {
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase alphanumeric words separated by single hyphens',
  })
  slug: string;
}

export class SourceIdParamDto {
  @IsString()
  @MaxLength(255)
  @Matches(SOURCE_ID_PATTERN, { message: 'sourceId contains unsupported characters' })
  sourceId: string;
}

/** Same rules as {@link SourceIdParamDto}, for routes whose path parameter is named `id`. */
export class ProductIdParamDto {
  @IsString()
  @MaxLength(255)
  @Matches(SOURCE_ID_PATTERN, { message: 'id contains unsupported characters' })
  id: string;
}

export class NumericIdParamDto {
  @Type(() => Number)
  @IsInt({ message: 'id must be an integer' })
  @Min(1, { message: 'id must be 1 or greater' })
  id: number;
}
