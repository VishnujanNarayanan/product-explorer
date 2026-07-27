import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from './product.entity';

@Entity('product_detail')
export class ProductDetail {
  @ApiProperty({ example: 41 })
  @PrimaryColumn({ name: 'product_id' })
  product_id: number;

  @ApiProperty({
    example: 'A Court of Thorns and Roses by Sarah J Maas. Lose yourself in a world spun...',
  })
  @Column('text')
  description: string;

  @ApiProperty({
    description:
      'Metadata from the page\'s JSON-LD block and its "Additional information" table.',
    example: {
      isbn13: '9781408728512',
      isbn10: '1408728516',
      publisher: 'Little, Brown Book Group',
      year_published: '2023-04-27',
      binding_type: 'Paperback',
      condition: 'Very Good',
      pages: 336,
      sku: 'GOR013067345',
      category_path: 'Fiction Books > Thriller & Suspense',
    },
  })
  @Column('jsonb', { nullable: true })
  specs: any;

  @ApiProperty({
    nullable: true,
    example: null,
    description:
      'Always null. World of Books publishes no rating markup, and the assignment asks for ' +
      'ratings "if present", so nothing is synthesised here.',
  })
  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  ratings_avg: number;

  @ApiProperty({ example: 0, description: 'Always 0 — see ratings_avg.' })
  @Column({ name: 'reviews_count', default: 0 })
  reviews_count: number;

  @OneToOne(() => Product, (product) => product.detail)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
