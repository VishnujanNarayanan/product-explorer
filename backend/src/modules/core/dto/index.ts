import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
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
  /** Narrow the listing to one collection. Omitted means "every category". */
  @ApiPropertyOptional({
    example: 'fantasy-fiction-books',
    description: 'Category slug to filter by. Omit to list across every category.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN, {
    message: 'category must be lowercase alphanumeric words separated by single hyphens',
  })
  category?: string;

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

/**
 * One product as scraped by a visitor's browser.
 *
 * This is the only endpoint in the app that stores something the server did not fetch itself,
 * and it exists because World of Books rate-limits the datacentre the API runs in while serving
 * a visitor's own browser normally. That makes the browser the only thing here that can reach
 * the storefront — and makes this the one place where input is genuinely untrusted.
 *
 * So the rules below are tighter than validation usually needs to be: the URLs must point at
 * World of Books and Shopify's CDN rather than merely being well-formed, the id must look like a
 * Shopify id, and the price must be plausible for a used book. A caller can still post a
 * plausible-looking book that does not exist — that is inherent in accepting client data, and it
 * is why the browser is trusted only to relay a public feed, never to assert anything else.
 */
export class ImportedProductDto {
  @ApiProperty({ example: '9810968609041', description: "The Shopify product id." })
  @IsString()
  @Matches(/^\d{5,20}$/, { message: 'source_id must be a Shopify numeric id' })
  source_id: string;

  @ApiProperty({ example: 'The Murder of Roger Ackroyd' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'Agatha Christie', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string | null;

  // Upper bound is deliberate: a used-book listing is not four figures, and an absurd price is
  // the cheapest possible tell that a payload was hand-written.
  @ApiProperty({ example: 7.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  price: number;

  @ApiProperty({ example: 'GBP' })
  @IsIn(['GBP'], { message: 'currency must be GBP; the storefront scraped is /en-gb' })
  currency: string;

  @ApiProperty({ example: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/0007527527.jpg' })
  @IsString()
  @MaxLength(1000)
  @Matches(/^(https:\/\/cdn\.shopify\.com\/|$)/, {
    message: 'image_url must be a Shopify CDN URL',
  })
  image_url: string;

  @ApiProperty({
    example: 'https://www.worldofbooks.com/en-gb/products/murder-of-roger-ackroyd-book-agatha-christie-9780007527526',
  })
  @IsString()
  @MaxLength(1000)
  @Matches(/^https:\/\/www\.worldofbooks\.com\/en-gb\/products\/[a-z0-9-]+$/i, {
    message: 'source_url must be a World of Books product URL',
  })
  source_url: string;
}

export class ImportScrapedProductsDto {
  @ApiProperty({
    type: [ImportedProductDto],
    description: 'Products the visitor’s browser read from the collection feed.',
  })
  @IsArray()
  @ArrayNotEmpty()
  // A collection page is 250 at most; anything larger is not a page of a feed.
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => ImportedProductDto)
  products: ImportedProductDto[];

  @ApiPropertyOptional({
    example: 1,
    description: 'Feed page these came from, so the category checkpoint can advance.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  page?: number;
}

export class ScrapeCategoryBodyDto {
  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Fetch the next page from World of Books during this request, rather than only when the ' +
      'category has nothing stored. This is what "scrape again" and "load more" ask for.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean({ message: 'refresh must be true or false' })
  refresh?: boolean;
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
