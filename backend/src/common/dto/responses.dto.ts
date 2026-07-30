import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../../entities/category.entity';
import { Navigation } from '../../entities/navigation.entity';
import { Product } from '../../entities/product.entity';

/** Shared paging fields returned by every list endpoint. */
export class PaginationMetaDto {
  @ApiProperty({ example: 428, description: 'Total rows matching the query, ignoring paging.' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 24 })
  limit: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class PaginatedProductsDto extends PaginationMetaDto {
  @ApiProperty({ type: [Product] })
  products: Product[];
}

export class CategoryProductsDto extends PaginationMetaDto {
  @ApiProperty({
    example: 'Scraping job queued for category: fantasy-fiction-books. Returning 24 existing products.',
  })
  message: string;

  @ApiProperty({ type: [Product] })
  products: Product[];

  @ApiProperty({ type: Category, required: false })
  category?: Category;

  @ApiProperty({
    example: true,
    description:
      'True when a background listing scrape was queued. Only happens while the collection ' +
      'still has unfetched pages, so browsing an exhausted category costs the origin nothing. ' +
      'False also when the queue could not be reached — it reports what happened, not what ' +
      'was intended.',
  })
  jobQueued: boolean;

  @ApiProperty({
    example: true,
    description: 'True when this request fetched from World of Books rather than only reading storage.',
  })
  scrapedNow: boolean;

  @ApiProperty({ example: 40, description: 'Products added by that fetch.' })
  addedCount: number;

  @ApiProperty({
    example: true,
    description: 'Whether the collection has pages left, which is what "load more" depends on.',
  })
  sourceHasMore: boolean;
}

export class ImportScrapedProductsResponseDto {
  @ApiProperty({ example: 'Stored 40 new and 0 updated products for author-books-by-agatha-christie' })
  message: string;

  @ApiProperty({ example: 40 })
  added: number;

  @ApiProperty({ example: 0 })
  updated: number;

  @ApiProperty({ example: 40, description: 'Products stored for the category after the import.' })
  total: number;
}

export class ScrapeNavigationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Navigation scraping completed. Found 6 navigation items.' })
  message: string;

  @ApiProperty({ type: [Navigation] })
  data: Navigation[];
}

export class ScrapeProductResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Product loaded successfully' })
  message: string;

  @ApiProperty({ type: Product })
  data: Product;

  @ApiProperty({ example: true, description: 'Whether a product_detail row is already stored.' })
  hasDetails: boolean;

  @ApiProperty({ example: false, description: 'Whether a detail scrape was queued.' })
  jobQueued: boolean;
}

export class HealthResponseDto {
  @ApiProperty({ example: 'OK' })
  status: string;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  timestamp: Date;

  @ApiProperty({ example: { database: 'OK' } })
  services: Record<string, string>;
}

export class CacheClearResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Cache cleared successfully' })
  message: string;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  timestamp: Date;
}

export class CleanupResponseDto {
  @ApiProperty({ example: 12 })
  deleted: number;

  @ApiProperty({ example: 'Removed 12 stale rows' })
  message: string;
}

/** The shape Nest's exception layer returns, documented so clients can rely on it. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'A single string, or one entry per failed constraint for validation errors.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['limit may not exceed 100'],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
