"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapeProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
let ScrapeProcessor = (() => {
    let _classDecorators = [(0, common_1.Injectable)(), (0, bull_1.Processor)('scraping')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _handleNavigationScrape_decorators;
    let _handleCategoryScrape_decorators;
    let _handleProductDetailScrape_decorators;
    var ScrapeProcessor = _classThis = class {
        constructor(categoryRepo, productRepo, productDetailRepo, reviewRepo, scrapeJobRepo, categoryScraper, productDetailScraper, navigationScraper, scraperService) {
            this.categoryRepo = (__runInitializers(this, _instanceExtraInitializers), categoryRepo);
            this.productRepo = productRepo;
            this.productDetailRepo = productDetailRepo;
            this.reviewRepo = reviewRepo;
            this.scrapeJobRepo = scrapeJobRepo;
            this.categoryScraper = categoryScraper;
            this.productDetailScraper = productDetailScraper;
            this.navigationScraper = navigationScraper;
            this.scraperService = scraperService;
            this.logger = new common_1.Logger(ScrapeProcessor.name);
        }
        async handleNavigationScrape(job) {
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
            }
            catch (error) {
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
        async handleCategoryScrape(job) {
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
                        }
                        else {
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
                    }
                    catch (error) {
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
            }
            catch (error) {
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
        async handleProductDetailScrape(job) {
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
                }
                else {
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
                    const reviewExists = existingReviews.some(r => r.text === reviewData.text && r.author === (reviewData.author || 'Anonymous'));
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
            }
            catch (error) {
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
    };
    __setFunctionName(_classThis, "ScrapeProcessor");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _handleNavigationScrape_decorators = [(0, bull_1.Process)('scrape-navigation')];
        _handleCategoryScrape_decorators = [(0, bull_1.Process)('scrape-category')];
        _handleProductDetailScrape_decorators = [(0, bull_1.Process)('scrape-product-detail')];
        __esDecorate(_classThis, null, _handleNavigationScrape_decorators, { kind: "method", name: "handleNavigationScrape", static: false, private: false, access: { has: obj => "handleNavigationScrape" in obj, get: obj => obj.handleNavigationScrape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleCategoryScrape_decorators, { kind: "method", name: "handleCategoryScrape", static: false, private: false, access: { has: obj => "handleCategoryScrape" in obj, get: obj => obj.handleCategoryScrape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleProductDetailScrape_decorators, { kind: "method", name: "handleProductDetailScrape", static: false, private: false, access: { has: obj => "handleProductDetailScrape" in obj, get: obj => obj.handleProductDetailScrape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScrapeProcessor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScrapeProcessor = _classThis;
})();
exports.ScrapeProcessor = ScrapeProcessor;
