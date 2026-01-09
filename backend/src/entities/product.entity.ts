import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { Category } from './category.entity';
import { ProductDetail } from './product-detail.entity';
import { Review } from './review.entity';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  source_id: string;

  @Column()
  title: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ default: 'GBP' })
  currency: string;

  @Column()
  image_url: string;

  @Column()
  source_url: string;

  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToOne(() => ProductDetail, (detail) => detail.product)
  detail: ProductDetail;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];
}
