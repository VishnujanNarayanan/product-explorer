import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Category } from './category.entity';
import { ProductDetail } from './product-detail.entity';
import { Review } from './review.entity';

@Entity('product')
export class Product {
  @ApiProperty({ example: 41 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: '9846944432401',
    description:
      'The Shopify product id. Falls back to the URL handle when a page does not expose one.',
  })
  @Column({ unique: true })
  source_id: string;

  @ApiProperty({ example: 'A Court of Thorns and Roses' })
  @Column()
  title: string;

  @ApiProperty({
    nullable: true,
    example: 'Sarah J Maas',
    description:
      'Parsed from the Shopify handle — products.json carries no author field (vendor is always "WoB").',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string | null;

  @ApiProperty({ example: '4.10', description: 'Cheapest in-stock variant, in major units.' })
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @ApiProperty({ example: 'GBP' })
  @Column({ default: 'GBP' })
  currency: string;

  @ApiProperty({ example: 'https://cdn.shopify.com/s/files/1/0784/4072/6801/files/152668.jpg' })
  @Column()
  image_url: string;

  @ApiProperty({
    example:
      'https://www.worldofbooks.com/en-gb/products/court-of-thorns-and-roses-book-sarah-j-maas-9780008387884',
  })
  @Column()
  source_url: string;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ApiProperty({ type: () => Category, required: false })
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ApiProperty({
    type: () => ProductDetail,
    required: false,
    description: 'Present once the product page has been scraped; detail is fetched lazily.',
  })
  @OneToOne(() => ProductDetail, (detail) => detail.product)
  detail: ProductDetail;

  @ApiProperty({
    type: () => [Review],
    required: false,
    description: 'Always empty — World of Books publishes no review markup.',
  })
  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];
}
