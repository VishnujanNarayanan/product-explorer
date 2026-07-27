import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Category } from './category.entity';

@Entity('navigation')
export class Navigation {
  @ApiProperty({ example: 2 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Fiction Books' })
  @Column()
  title: string;

  @ApiProperty({ example: 'fiction-books' })
  @Column({ unique: true })
  slug: string;

  @ApiProperty({ example: '2026-07-27T10:36:00.000Z' })
  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ApiProperty({ type: () => [Category], required: false })
  @OneToMany(() => Category, (category) => category.navigation)
  categories: Category[];
}
