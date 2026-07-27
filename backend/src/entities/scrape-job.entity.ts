import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('scrape_job')
export class ScrapeJob {
  @ApiProperty({ example: 7 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'https://www.worldofbooks.com/en-gb/collections/fantasy-fiction-books' })
  @Column()
  target_url: string;

  @ApiProperty({ example: 'category', enum: ['navigation', 'category', 'product', 'product_detail'] })
  @Column()
  target_type: string;

  @ApiProperty({ example: 'completed', enum: ['pending', 'processing', 'completed', 'failed'] })
  @Column()
  status: string;

  @ApiProperty({ nullable: true, example: '2026-07-27T10:36:00.000Z' })
  @Column({ type: 'timestamp', nullable: true })
  started_at: Date;

  @ApiProperty({ nullable: true, example: '2026-07-27T10:36:12.000Z' })
  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date;

  @ApiProperty({ nullable: true, example: null })
  @Column({ type: 'text', nullable: true })
  error_log: string;

  @ApiProperty({ required: false, example: 40 })
  @Column({ nullable: true })
  result_count?: number;

  @ApiProperty({ required: false, example: 'medium', enum: ['low', 'medium', 'high'] })
  @Column({ default: 'medium' })
  priority?: string;
}
