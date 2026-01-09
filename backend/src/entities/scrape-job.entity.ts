import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('scrape_job')
export class ScrapeJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  target_url: string;

  @Column()
  target_type: string; // 'navigation', 'category', 'product', 'product_detail'

  @Column()
  status: string; // 'pending', 'processing', 'completed', 'failed'

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date;

  @Column({ type: 'text', nullable: true })
  error_log: string;
}
