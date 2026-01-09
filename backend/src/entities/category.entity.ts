import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Navigation } from './navigation.entity';
import { Product } from './product.entity';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'product_count', default: 0 })
  product_count: number;

  @Column({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_scraped_at: Date;

  @ManyToOne(() => Navigation, (navigation) => navigation.categories)
  @JoinColumn({ name: 'navigation_id' })
  navigation: Navigation;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
