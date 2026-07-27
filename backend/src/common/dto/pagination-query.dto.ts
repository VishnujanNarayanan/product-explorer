import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Paging for list endpoints.
 *
 * Query strings are always strings, so `@Type(() => Number)` has to run before `@IsInt` —
 * without it every numeric constraint fails on a value that is perfectly valid.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be 1 or greater' })
  page?: number = 1;

  /**
   * Capped so a single request cannot ask the database for the entire catalogue.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be 1 or greater' })
  @Max(100, { message: 'limit may not exceed 100' })
  limit?: number = 24;

  /** Rows to skip, derived from the validated page/limit pair. */
  get offset(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 24);
  }
}
