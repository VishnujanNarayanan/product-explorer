import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SLUG_PATTERN } from '../../../common/dto/params.dto';

/**
 * `?refresh=true` arrives as the *string* "true". Coerce explicitly rather than relying on
 * implicit conversion, which would treat any non-empty string — including "false" — as true.
 */
const toBoolean = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return value; // let @IsBoolean produce the error
  });

/** The `?navigation=` slug, shared by every route that has to disambiguate a category. */
const NavigationSlugProperty = (description: string) => (target: object, key: string) => {
  ApiPropertyOptional({ example: 'fiction-books', description })(target, key);
  IsOptional()(target, key);
  IsString()(target, key);
  MaxLength(255)(target, key);
  Matches(SLUG_PATTERN, {
    message: 'navigation must be lowercase alphanumeric words separated by single hyphens',
  })(target, key);
};

export class GetCategoriesQueryDto {
  /** Filter to one navigation heading. Omitted means "every category". */
  @NavigationSlugProperty('Navigation heading slug. Omit to list every category.')
  navigation?: string;
}

/**
 * A slug identifies a category only within a heading — the same collection is listed under
 * several headings — so routes that take a slug accept the heading alongside it.
 */
export class GetCategoryQueryDto {
  @NavigationSlugProperty(
    'Navigation heading the category was reached through. Omit and the oldest match wins.',
  )
  navigation?: string;
}

export class GetProductQueryDto {
  /** Force a fresh detail scrape instead of serving the cached row. */
  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Force a fresh detail scrape instead of serving the stored row.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean({ message: 'refresh must be true or false' })
  refresh?: boolean;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  /** Draw a random sample instead of a page — what the home shelf asks for. */
  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Return a random sample of products that have a cover image, instead of a page in ' +
      'scrape order. `page` is ignored when set.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean({ message: 'random must be true or false' })
  random?: boolean;
}

export class ScrapeProductBodyDto {
  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Re-scrape the product page even if a stored detail row exists.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean({ message: 'refresh must be true or false' })
  refresh?: boolean;
}

export class CategoryProductsQueryDto extends PaginationQueryDto {
  @NavigationSlugProperty(
    'Navigation heading the category was reached through. Omit and the oldest match wins.',
  )
  navigation?: string;
}

export enum LegacyScrapeType {
  NAVIGATION = 'navigation',
  CATEGORY = 'category',
  PRODUCT = 'product',
}

export class LegacyScrapeParamsDto {
  @ApiProperty({ enum: LegacyScrapeType, example: LegacyScrapeType.CATEGORY })
  @IsEnum(LegacyScrapeType, {
    message: `type must be one of: ${Object.values(LegacyScrapeType).join(', ')}`,
  })
  type: LegacyScrapeType;

  /**
   * Deliberately permissive: the legacy route accepts a slug, a bare keyword like "home",
   * or a full URL, depending on the type.
   */
  @ApiProperty({
    example: 'fantasy-fiction-books',
    description: 'A slug, the keyword "home"/"all", or a full URL, depending on `type`.',
  })
  @IsString()
  @MaxLength(2048)
  target: string;
}
