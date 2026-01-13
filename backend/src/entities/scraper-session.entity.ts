// backend/src/entities/scraper-session.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('scraper_session')
export class ScraperSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  session_id: string;

  @Column({ nullable: true })
  user_id: string;

  @Column({ nullable: true })
  current_url: string;

  @Column('jsonb', { nullable: true })
  browser_state: any; // Serialized browser state for restoration

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_active: Date;

  @Column({ default: 'active' })
  status: 'active' | 'idle' | 'terminated';

  @Column('jsonb', { nullable: true })
  stats: {
    total_products_scraped: number;
    last_category_scraped: string;
    load_more_count: number;
  };
}