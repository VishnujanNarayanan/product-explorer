import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScraperService } from '../scraper.service';
import { CategoryScraper } from '../scrapers/category.scraper';
import { ProductDetailScraper } from '../scrapers/product-detail.scraper';
import { NavigationScraper } from '../scrapers/navigation.scraper';

import { Category } from '../../../entities/category.entity';
import { Product } from '../../../entities/product.entity';
import { ProductDetail } from '../../../entities/product-detail.entity';
import { Review } from '../../../entities/review.entity';
import { ScrapeJob } from '../../../entities/scrape-job.entity';

@Injectable()
@Processor('scraping')
export class ScrapeProcessor {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ProductDetail)
    private productDetailRepo: Repository<ProductDetail>,
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(ScrapeJob)
    private scrapeJobRepo: Repository<ScrapeJob>,
    
    private readonly categoryScraper: CategoryScraper,
    private readonly productDetailScraper: ProductDetailScraper,
    private readonly navigationScraper: NavigationScraper,
    private readonly scraperService: ScraperService,
  ) {}

  @Process('scrape-navigation')
  async handleNavigationScrape(job: Job) {
    const { jobId } = job.data;
    this.logger.log(`Processing navigation scrape job: ${jobId}`);
    
    try {
      const scrapeJob = await this.scrapeJobRepo.findOne({ where: { id: jobId } });
      if (scrapeJob) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'processing',
          started_at: new Date(),
        });
      }

      await this.scraperService.scrapeAndSaveNavigation();
      
      if (scrapeJob) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'completed',
          finished_at: new Date(),
        });
      }
      
      this.logger.log(`Navigation scrape completed for job: ${jobId}`);
    } catch (error) {
      this.logger.error(`Navigation scrape failed for job ${jobId}: ${error.message}`);
      
      const scrapeJob = await this.scrapeJobRepo.findOne({ where: { id: jobId } });
      if (scrapeJob) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'failed',
          finished_at: new Date(),
          error_log: error.message,
        });
      }
      
      throw error;
    }
  }

  @Process('scrape-category')
  async handleCategoryScrape(job: Job) {
    const { categorySlug, categoryId, url, jobId, navigationSlug } = job.data;
    this.logger.log(`Processing category scrape: ${categorySlug}${navigationSlug ? ` (via nav: ${navigationSlug})` : ''}`);
    
    try {
      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'processing',
          started_at: new Date(),
        });
      }

      // Scrape products from category page, passing navigation context for proper site navigation
      const products = await this.categoryScraper.scrape(url, categorySlug, 100, navigationSlug);
      
      // Get category entity
      const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
      if (!category) {
        throw new Error(`Category not found: ${categoryId}`);
      }

      // Save products to database
      let savedCount = 0;
      let skippedCount = 0;
      
      for (const productData of products) {
        try {
          // Check for existing product by source_id
          const existingProduct = await this.productRepo.findOne({
            where: { source_id: productData.source_id },
          });

          if (existingProduct) {
            // Update existing product
            existingProduct.title = productData.title;
            existingProduct.price = productData.price;
            existingProduct.currency = productData.currency;
            existingProduct.image_url = productData.image_url;
            existingProduct.last_scraped_at = new Date();
            await this.productRepo.save(existingProduct);
            skippedCount++;
          } else {
            // Create new product
            const newProduct = this.productRepo.create({
              source_id: productData.source_id,
              title: productData.title,
              price: productData.price,
              currency: productData.currency,
              image_url: productData.image_url,
              source_url: productData.source_url,
              category,
              last_scraped_at: new Date(),
            });
            await this.productRepo.save(newProduct);
            savedCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to save product ${productData.source_id}: ${error.message}`);
        }
      }

      // Update category product count and timestamp
      category.product_count = await this.productRepo.count({ where: { category: { id: categoryId } } });
      category.last_scraped_at = new Date();
      await this.categoryRepo.save(category);

      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'completed',
          finished_at: new Date(),
        });
      }

      this.logger.log(`Category ${categorySlug} scrape completed: ${savedCount} new, ${skippedCount} updated`);
    } catch (error) {
      this.logger.error(`Category scrape failed for ${categorySlug}: ${error.message}`);
      
      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'failed',
          finished_at: new Date(),
          error_log: error.message,
        });
      }
      
      throw error;
    }
  }

  @Process('scrape-product-detail')
  async handleProductDetailScrape(job: Job) {
    const { productId, url, sourceId, jobId } = job.data;
    this.logger.log(`Processing product detail scrape: ${sourceId}`);
    
    try {
      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'processing',
          started_at: new Date(),
        });
      }

      // Scrape product details
      const detailData = await this.productDetailScraper.scrape(url, sourceId);
      
      // Get product entity
      const product = await this.productRepo.findOne({
        where: { id: productId },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Save or update product detail
      let existingDetail = await this.productDetailRepo.findOne({
        where: { product_id: product.id },
      });

      if (existingDetail) {
        // Update existing detail
        existingDetail.description = detailData.description;
        existingDetail.specs = detailData.specs;
        existingDetail.reviews_count = detailData.reviews.length;
        await this.productDetailRepo.save(existingDetail);
        this.logger.debug(`Updated existing detail for product ${product.id}`);
      } else {
        // Create new detail
        const newDetail = this.productDetailRepo.create({
          product_id: product.id,
          description: detailData.description,
          specs: detailData.specs,
          reviews_count: detailData.reviews.length,
        });
        
        this.logger.debug(`Creating new detail for product ID: ${product.id}`);
        await this.productDetailRepo.save(newDetail);
        this.logger.debug(`Created new detail for product ${product.id}`);
      }

      // Save reviews - only add new ones to avoid duplicates
      const existingReviews = await this.reviewRepo.find({
        where: { product: { id: product.id } },
      });

      for (const reviewData of detailData.reviews) {
        const reviewExists = existingReviews.some(
          r => r.text === reviewData.text && r.author === (reviewData.author || 'Anonymous')
        );

        if (!reviewExists) {
          const review = this.reviewRepo.create({
            product: product,
            author: reviewData.author || 'Anonymous',
            rating: reviewData.rating || 0,
            text: reviewData.text,
          });
          await this.reviewRepo.save(review);
        }
      }

      // Update product timestamp
      product.last_scraped_at = new Date();
      await this.productRepo.save(product);

      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'completed',
          finished_at: new Date(),
        });
      }

      this.logger.log(`Product detail scrape completed for: ${sourceId}`);
    } catch (error) {
      this.logger.error(`Product detail scrape failed for ${sourceId}: ${error.message}`);
      
      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'failed',
          finished_at: new Date(),
          error_log: error.message,
        });
      }
      
      throw error;
    }
  }
}