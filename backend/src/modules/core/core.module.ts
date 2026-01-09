import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { ScraperModule } from '../scraper/scraper.module'; 
import { Navigation } from '../../entities/navigation.entity';
import { Category } from '../../entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Navigation, Category]),
    ScraperModule, // ADD THIS IMPORT
  ],
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}