import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_detail')
export class ProductDetail {
  @PrimaryColumn({ name: 'product_id' })
  product_id: number;

  @Column('text')
  description: string;

  @Column('jsonb', { nullable: true })
  specs: any;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  ratings_avg: number;

  @Column({ name: 'reviews_count', default: 0 })
  reviews_count: number;

  @OneToOne(() => Product, (product) => product.detail)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
