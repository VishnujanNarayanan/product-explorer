import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from './product.entity';

/**
 * Present for schema completeness only. World of Books publishes no review markup anywhere —
 * verified by scanning for [class*="rating"], [class*="review"], [class*="star"] and
 * [data-rating], all of which match zero elements. The table stays empty rather than being
 * filled with synthesised reviews.
 */
@Entity('review')
export class Review {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'A. Reader' })
  @Column()
  author: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Column('int')
  rating: number;

  @ApiProperty({ example: 'Arrived in great condition.' })
  @Column('text')
  text: string;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Product, (product) => product.reviews)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
