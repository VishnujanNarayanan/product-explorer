import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Navigation } from './navigation.entity';
import { Product } from './product.entity';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'product_count', default: 0 })
  product_count: number;

  /**
   * Listing checkpoint. Products are filled in gradually: each scrape resumes from the page
   * after this one, so re-opening a category continues where the last run stopped instead of
   * re-fetching from the beginning.
   */
  @Column({ name: 'last_page_scraped', default: 0 })
  last_page_scraped: number;

  /** Set once a short page proves the collection has no further products. */
  @Column({ name: 'is_exhausted', default: false })
  is_exhausted: boolean;

  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ManyToOne(() => Navigation, (navigation) => navigation.categories)
  @JoinColumn({ name: 'navigation_id' })
  navigation: Navigation;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
