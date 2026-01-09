import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Product } from './product.entity';

@Entity('review')
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  author: string;

  @Column('int')
  rating: number;

  @Column('text')
  text: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Product, (product) => product.reviews)
  product: Product;
}
