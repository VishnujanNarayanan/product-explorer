import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Category } from './category.entity';

@Entity('navigation')
export class Navigation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @OneToMany(() => Category, (category) => category.navigation)
  categories: Category[];
}
