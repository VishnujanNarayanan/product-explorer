import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SLUG_PATTERN } from '../../../common/dto/params.dto';

export class GetProductsQueryDto extends PaginationQueryDto {
  /** Restrict to one category. Omitted means "every product". */
  @ApiPropertyOptional({
    example: 'fantasy-fiction-books',
    description: 'Category slug. Omit to list across every category.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SLUG_PATTERN, {
    message: 'category must be lowercase alphanumeric words separated by single hyphens',
  })
  category?: string;
}
