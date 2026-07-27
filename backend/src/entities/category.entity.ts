import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Navigation } from './navigation.entity';
import { Product } from './product.entity';

@Entity('category')
export class Category {
  @ApiProperty({ example: 11 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Fantasy' })
  @Column()
  title: string;

  @ApiProperty({ example: 'fantasy-fiction-books' })
  @Column({ unique: true })
  slug: string;

  @ApiProperty({ example: 0 })
  @Column({ name: 'product_count', default: 0 })
  product_count: number;

  /**
   * Listing checkpoint. Products are filled in gradually: each scrape resumes from the page
   * after this one, so re-opening a category continues where the last run stopped instead of
   * re-fetching from the beginning.
   */
  @ApiProperty({
    example: 1,
    description: 'Listing checkpoint — the last products.json page fetched for this collection.',
  })
  @Column({ name: 'last_page_scraped', default: 0 })
  last_page_scraped: number;

  /** Set once a short page proves the collection has no further products. */
  @ApiProperty({
    example: false,
    description: 'True once a short page proves the collection has no further products.',
  })
  @Column({ name: 'is_exhausted', default: false })
  is_exhausted: boolean;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ApiProperty({ type: () => Navigation, required: false })
  @ManyToOne(() => Navigation, (navigation) => navigation.categories)
  @JoinColumn({ name: 'navigation_id' })
  navigation: Navigation;

  @ApiProperty({ type: () => Category, required: false, nullable: true })
  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @ApiProperty({ type: () => [Category], required: false })
  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @ApiProperty({ type: () => [Product], required: false })
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
