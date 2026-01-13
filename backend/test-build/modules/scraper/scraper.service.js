"use strict";
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ScraperService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ScraperService = _classThis = class {
        constructor(navigationScraper, categoryScraper, productScraper, productDetailScraper, navigationRepo, categoryRepo, productRepo, productDetailRepo, reviewRepo, scrapeJobRepo, scrapingQueue, cacheManager) {
            this.navigationScraper = navigationScraper;
            this.categoryScraper = categoryScraper;
            this.productScraper = productScraper;
            this.productDetailScraper = productDetailScraper;
            this.navigationRepo = navigationRepo;
            this.categoryRepo = categoryRepo;
            this.productRepo = productRepo;
            this.productDetailRepo = productDetailRepo;
            this.reviewRepo = reviewRepo;
            this.scrapeJobRepo = scrapeJobRepo;
            this.scrapingQueue = scrapingQueue;
            this.cacheManager = cacheManager;
            this.logger = new common_1.Logger(ScraperService.name);
            this.BASE_URL = 'https://www.worldofbooks.com';
        }
        async onModuleInit() {
            const count = await this.navigationRepo.count();
            if (count === 0) {
                await this.scrapeAndSaveNavigation();
            }
        }
        async scrapeAndSaveNavigation() {
            const cacheKey = 'navigation_data';
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                this.logger.log('Returning cached navigation data');
                return cached;
            }
            try {
                const job = await this.scrapeJobRepo.save({
                    target_url: this.BASE_URL,
                    target_type: 'navigation',
                    status: 'processing',
                    started_at: new Date(),
                });
                const { navigation, categories } = await this.navigationScraper.scrape(this.BASE_URL);
                const savedNavigation = [];
                for (const navItem of navigation) {
                    const existing = await this.navigationRepo.findOne({ where: { slug: navItem.slug } });
                    if (existing) {
                        existing.last_scraped_at = new Date();
                        await this.navigationRepo.save(existing);
                        savedNavigation.push(existing);
                    }
                    else {
                        const newNav = this.navigationRepo.create({
                            title: navItem.title,
                            slug: navItem.slug,
                            last_scraped_at: new Date(),
                        });
                        const saved = await this.navigationRepo.save(newNav);
                        savedNavigation.push(saved);
                    }
                }
                for (const categoryItem of categories) {
                    const parentNav = await this.navigationRepo.findOne({
                        where: { slug: categoryItem.parentSlug }
                    });
                    const existingCategory = await this.categoryRepo.findOne({
                        where: { slug: categoryItem.slug }
                    });
                    if (existingCategory) {
                        existingCategory.last_scraped_at = new Date();
                        await this.categoryRepo.save(existingCategory);
                    }
                    else if (parentNav) {
                        const newCategory = this.categoryRepo.create({
                            title: categoryItem.title,
                            slug: categoryItem.slug,
                            navigation: parentNav,
                            last_scraped_at: new Date(),
                        });
                        await this.categoryRepo.save(newCategory);
                    }
                }
                await this.scrapeJobRepo.update(job.id, {
                    status: 'completed',
                    finished_at: new Date(),
                });
                await this.cacheManager.set(cacheKey, savedNavigation, 24 * 60 * 60 * 1000);
                this.logger.log(`Navigation scraping completed: ${savedNavigation.length} nav items, ${categories.length} categories saved`);
                return savedNavigation;
            }
            catch (error) {
                this.logger.error(`Navigation scraping failed: ${error.message}`);
                throw error;
            }
        }
        async scrapeCategoryBySlug(slug) {
            const cacheKey = `category_${slug}`;
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                this.logger.log(`Returning cached products for category: ${slug}`);
                return {
                    message: `Returning cached products for ${slug}`,
                    products: cached,
                    jobQueued: false
                };
            }
            const category = await this.categoryRepo.findOne({
                where: { slug },
                relations: ['navigation']
            });
            if (!category) {
                throw new Error(`Category not found: ${slug}`);
            }
            // Get navigation slug for proper site navigation
            const navigationSlug = category.navigation?.slug || null;
            await this.scrapingQueue.add('scrape-category', {
                categorySlug: slug,
                categoryId: category.id,
                navigationSlug: navigationSlug,
                url: `${this.BASE_URL}/collections/${slug}`,
            });
            const products = await this.productRepo.find({
                where: { category: { id: category.id } },
                relations: ['category'],
                take: 50
            });
            await this.cacheManager.set(cacheKey, products, 60 * 60 * 1000);
            return {
                message: `Scraping job queued for category: ${slug}. Returning ${products.length} existing products.`,
                products,
                category,
                jobQueued: true
            };
        }
        async scrapeProductBySourceId(sourceId, forceRefresh = false) {
            const cacheKey = `product_${sourceId}`;
            if (!forceRefresh) {
                const cached = await this.cacheManager.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            try {
                const product = await this.productRepo.findOne({
                    where: { source_id: sourceId },
                    relations: ['detail', 'reviews', 'category'],
                });
                if (!product) {
                    this.logger.warn(`Product not found: ${sourceId}`);
                    return null;
                }
                if (forceRefresh || !product.detail) {
                    await this.scrapingQueue.add('scrape-product-detail', {
                        productId: product.id,
                        url: product.source_url,
                        sourceId: product.source_id,
                    });
                }
                await this.cacheManager.set(cacheKey, product, 24 * 60 * 60 * 1000);
                return product;
            }
            catch (error) {
                this.logger.error(`Error fetching product ${sourceId}: ${error.message}`);
                return null;
            }
        }
        async triggerOnDemandScrape(type, target) {
            const job = await this.scrapeJobRepo.save({
                target_url: target,
                target_type: type,
                status: 'pending',
                started_at: new Date(),
            });
            try {
                switch (type) {
                    case 'navigation':
                        const url = target || this.BASE_URL;
                        await this.scrapingQueue.add('scrape-navigation', {
                            jobId: job.id,
                            url
                        });
                        break;
                    case 'category':
                        const category = await this.categoryRepo.findOne({
                            where: { slug: target }
                        });
                        if (!category) {
                            throw new Error(`Category not found: ${target}`);
                        }
                        await this.scrapingQueue.add('scrape-category', {
                            categorySlug: target,
                            categoryId: category.id,
                            url: `${this.BASE_URL}/collections/${target}`,
                            jobId: job.id
                        });
                        break;
                    case 'product':
                        const product = await this.productRepo.findOne({
                            where: { source_id: target }
                        });
                        if (!product) {
                            throw new Error(`Product not found: ${target}`);
                        }
                        await this.scrapingQueue.add('scrape-product-detail', {
                            sourceId: target,
                            productId: product.id,
                            url: product.source_url,
                            jobId: job.id
                        });
                        break;
                }
                return {
                    success: true,
                    message: `Job ${job.id} queued for ${type} scrape`,
                    jobId: job.id
                };
            }
            catch (error) {
                await this.scrapeJobRepo.update(job.id, {
                    status: 'failed',
                    finished_at: new Date(),
                    error_log: error.message
                });
                throw error;
            }
        }
        async getScrapeJobStatus(jobId) {
            return this.scrapeJobRepo.findOne({ where: { id: jobId } });
        }
        async cleanupOldData() {
            try {
                // Get IDs of the 8 CORRECT navigation items
                const correctNavigation = await this.navigationRepo.find({
                    where: [
                        { title: 'Clearance' },
                        { title: 'eGift Cards' },
                        { title: 'Fiction Books' },
                        { title: 'Non-Fiction Books' },
                        { title: 'Children\'s Books' },
                        { title: 'Rare Books' },
                        { title: 'Music & Film' },
                        { title: 'Sell Your Books' }
                    ]
                });
                const correctIds = correctNavigation.map(nav => nav.id);
                if (correctIds.length === 0) {
                    return { deleted: 0, message: 'No correct navigation items found' };
                }
                let totalDeleted = 0;
                const messages = [];
                // Use TypeORM queries instead of raw SQL to avoid table name issues
                // Delete products linked to wrong categories
                const wrongProducts = await this.productRepo.find({
                    relations: ['category', 'category.navigation'],
                    where: [
                        { category: { navigation: { id: (0, typeorm_1.Not)((0, typeorm_1.In)(correctIds)) } } },
                        { category: null } // Also delete orphaned products
                    ]
                });
                if (wrongProducts.length > 0) {
                    await this.productRepo.remove(wrongProducts);
                    totalDeleted += wrongProducts.length;
                    messages.push(`${wrongProducts.length} products`);
                }
                // Delete categories linked to wrong navigation
                const wrongCategories = await this.categoryRepo.find({
                    relations: ['navigation'],
                    where: [
                        { navigation: { id: (0, typeorm_1.Not)((0, typeorm_1.In)(correctIds)) } },
                        { navigation: null } // Also delete orphaned categories
                    ]
                });
                if (wrongCategories.length > 0) {
                    await this.categoryRepo.remove(wrongCategories);
                    totalDeleted += wrongCategories.length;
                    messages.push(`${wrongCategories.length} categories`);
                }
                // Delete wrong navigation items
                const wrongNavigation = await this.navigationRepo.find({
                    where: { id: (0, typeorm_1.Not)((0, typeorm_1.In)(correctIds)) }
                });
                if (wrongNavigation.length > 0) {
                    await this.navigationRepo.remove(wrongNavigation);
                    totalDeleted += wrongNavigation.length;
                    messages.push(`${wrongNavigation.length} navigation`);
                }
                const message = totalDeleted > 0
                    ? `Cleaned up ${totalDeleted} items (${messages.join(', ')})`
                    : 'No items to clean up';
                this.logger.log(`Cleanup: ${message}`);
                return {
                    deleted: totalDeleted,
                    message
                };
            }
            catch (error) {
                this.logger.error(`Cleanup failed: ${error.message}`);
                return {
                    deleted: 0,
                    message: `Cleanup failed: ${error.message}`
                };
            }
        }
        async clearCache() {
            try {
                const cache = this.cacheManager;
                if (cache.store?.reset) {
                    await cache.store.reset();
                }
                else if (cache.store?.flushAll) {
                    await cache.store.flushAll();
                }
                else if (cache.store?.clear) {
                    await cache.store.clear();
                }
                else {
                    const knownKeys = ['navigation_data'];
                    for (const key of knownKeys) {
                        await this.cacheManager.del(key);
                    }
                    const categories = await this.categoryRepo.find();
                    for (const category of categories) {
                        await this.cacheManager.del(`category_${category.slug}`);
                    }
                    const products = await this.productRepo.find();
                    for (const product of products) {
                        await this.cacheManager.del(`product_${product.source_id}`);
                    }
                }
                this.logger.log('Cache cleared successfully');
                return { success: true, message: 'Cache cleared successfully' };
            }
            catch (error) {
                this.logger.error(`Cache clear failed: ${error.message}`);
                return { success: false, message: `Cache clear failed: ${error.message}` };
            }
        }
    };
    __setFunctionName(_classThis, "ScraperService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScraperService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScraperService = _classThis;
})();
exports.ScraperService = ScraperService;
