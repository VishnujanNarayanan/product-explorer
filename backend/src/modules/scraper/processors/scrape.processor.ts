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
    const { categorySlug, categoryId, jobId, navigationSlug } = job.data;
    this.logger.log(`Processing category scrape: ${categorySlug}${navigationSlug ? ` (via nav: ${navigationSlug})` : ''}`);
    
    try {
      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'processing',
          started_at: new Date(),
        });
      }

      // Get category entity first — its checkpoint decides which page we resume from.
      const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
      if (!category) {
        throw new Error(`Category not found: ${categoryId}`);
      }

      if (category.is_exhausted && !job.data.forceRefresh) {
        this.logger.log(`Category ${categorySlug} already fully scraped — nothing to fetch`);
        if (jobId) {
          await this.scrapeJobRepo.update(jobId, { status: 'completed', finished_at: new Date() });
        }
        return;
      }

      // Resume from the page after the last one stored (fresh categories start at page 1).
      const startPage = job.data.forceRefresh ? 1 : (category.last_page_scraped || 0) + 1;
      const maxPages = job.data.maxPages ?? 1;

      const result = await this.categoryScraper.scrape(categorySlug, { startPage, maxPages });

      // Save products to database
      let savedCount = 0;
      let updatedCount = 0;

      for (const productData of result.products) {
        try {
          // Scoped to this category. source_id is unique per category, not globally, so a
          // collection listed under two headings fills both instead of the second scrape
          // moving every row off the first.
          const existingProduct = await this.productRepo.findOne({
            where: { source_id: productData.source_id, category: { id: category.id } },
          });

          if (existingProduct) {
            existingProduct.title = productData.title;
            existingProduct.author = productData.author;
            existingProduct.price = productData.price;
            existingProduct.currency = productData.currency;
            existingProduct.image_url = productData.image_url;
            existingProduct.last_scraped_at = new Date();
            await this.productRepo.save(existingProduct);
            updatedCount++;
          } else {
            const newProduct = this.productRepo.create({
              source_id: productData.source_id,
              title: productData.title,
              author: productData.author,
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

      // Advance the checkpoint only after the products for those pages are persisted, so an
      // interrupted run re-fetches the page instead of skipping it.
      category.last_page_scraped = result.nextPage ? result.nextPage - 1 : startPage + result.pagesFetched - 1;
      category.is_exhausted = result.exhausted;
      category.product_count = await this.productRepo.count({ where: { category: { id: categoryId } } });
      category.last_scraped_at = new Date();
      await this.categoryRepo.save(category);

      if (jobId) {
        await this.scrapeJobRepo.update(jobId, {
          status: 'completed',
          finished_at: new Date(),
        });
      }

      this.logger.log(
        `Category ${categorySlug} scrape completed: ${savedCount} new, ${updatedCount} updated ` +
          `(pages ${startPage}..${startPage + result.pagesFetched - 1}` +
          `${result.exhausted ? ', collection exhausted' : `, next page ${result.nextPage}`})`,
      );
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
      
      // Get product entity (with category, so related products can inherit it)
      const product = await this.productRepo.findOne({
        where: { id: productId },
        relations: ['category'],
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Save or update product detail
      const existingDetail = await this.productDetailRepo.findOne({
        where: { product_id: product.id },
      });

      // World of Books exposes no reviews or ratings, so ratings_avg stays null and
      // reviews_count stays 0 rather than being invented from marketing copy.
      if (existingDetail) {
        existingDetail.description = detailData.description;
        existingDetail.specs = detailData.specs;
        existingDetail.ratings_avg = detailData.ratings_avg as any;
        existingDetail.reviews_count = detailData.reviews_count;
        await this.productDetailRepo.save(existingDetail);
        this.logger.debug(`Updated existing detail for product ${product.id}`);
      } else {
        const newDetail = this.productDetailRepo.create({
          product_id: product.id,
          description: detailData.description,
          specs: detailData.specs,
          ratings_avg: detailData.ratings_avg as any,
          reviews_count: detailData.reviews_count,
        });

        await this.productDetailRepo.save(newDetail);
        this.logger.debug(`Created new detail for product ${product.id}`);
      }

      // Persist recommendations so the detail page can show related products. They are
      // stored against the same category and deduped by source_id like any other product.
      const relatedSaved = await this.saveRelatedProducts(detailData.related_products, product);

      // Backfill fields the listing feed could not provide.
      if (detailData.author && !product.author) product.author = detailData.author;
      if (detailData.image_url && !product.image_url) product.image_url = detailData.image_url;
      product.last_scraped_at = new Date();
      await this.productRepo.save(product);

      this.logger.debug(`Stored ${relatedSaved} related products for ${sourceId}`);

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

  /**
   * Upserts recommended products so the detail page has something to link to. These come from
   * Shopify's recommendations feed and may already exist from a listing scrape, so they are
   * matched on source_id within the parent's category. Existing rows are left alone apart
   * from a price refresh — a recommendation payload is thinner than a listing row and must
   * not overwrite good data.
   */
  private async saveRelatedProducts(related: any[], parent: Product): Promise<number> {
    if (!Array.isArray(related) || related.length === 0) return 0;

    let saved = 0;
    for (const rel of related) {
      if (!rel?.source_id || rel.source_id === parent.source_id) continue;

      try {
        const existing = await this.productRepo.findOne({
          where: parent.category
            ? { source_id: rel.source_id, category: { id: parent.category.id } }
            : { source_id: rel.source_id },
          order: { id: 'ASC' },
        });

        if (existing) {
          if (rel.price > 0) existing.price = rel.price;
          if (!existing.author && rel.author) existing.author = rel.author;
          await this.productRepo.save(existing);
        } else {
          await this.productRepo.save(
            this.productRepo.create({
              source_id: rel.source_id,
              title: rel.title,
              author: rel.author,
              price: rel.price,
              currency: 'GBP',
              image_url: rel.image_url,
              source_url: rel.url,
              category: parent.category,
              last_scraped_at: new Date(),
            }),
          );
          saved++;
        }
      } catch (error) {
        this.logger.warn(`Failed to save related product ${rel.source_id}: ${error.message}`);
      }
    }
    return saved;
  }
}