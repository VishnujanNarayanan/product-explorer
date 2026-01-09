import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('view_history')
export class ViewHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: string;

  @Column()
  session_id: string;

  @Column('jsonb')
  path_json: any; // Store navigation path as JSON

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
