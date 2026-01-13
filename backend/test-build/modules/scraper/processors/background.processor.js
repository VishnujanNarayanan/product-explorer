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
exports.BackgroundScraperProcessor = void 0;
// backend/src/modules/scraper/processors/background.processor.ts
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let BackgroundScraperProcessor = (() => {
    let _classDecorators = [(0, common_1.Injectable)(), (0, bull_1.Processor)('background-scraping')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _handleCategoryRefresh_decorators;
    let _handleStaleRefresh_decorators;
    let _handleFullSiteScan_decorators;
    let _handleNavigationRefresh_decorators;
    var BackgroundScraperProcessor = _classThis = class {
        constructor(navigationRepo, categoryRepo, productRepo, scrapeJobRepo, categoryScraper, navigationScraper) {
            this.navigationRepo = (__runInitializers(this, _instanceExtraInitializers), navigationRepo);
            this.categoryRepo = categoryRepo;
            this.productRepo = productRepo;
            this.scrapeJobRepo = scrapeJobRepo;
            this.categoryScraper = categoryScraper;
            this.navigationScraper = navigationScraper;
            this.logger = new common_1.Logger(BackgroundScraperProcessor.name);
        }
        /**
         * High priority: Refresh specific category (user requested)
         */
        async handleCategoryRefresh(job) {
            const { target, triggeredBy } = job.data;
            this.logger.log(`[HIGH] Refreshing category: ${target} (triggered by: ${triggeredBy})`);
            const scrapeJob = await this.scrapeJobRepo.save({
                target_url: `https://www.worldofbooks.com/collections/${target}`,
                target_type: 'category',
                status: 'processing',
                started_at: new Date(),
                priority: 'high',
            });
            try {
                // Scrape with higher priority (shorter delays)
                const products = await this.categoryScraper.scrape(`https://www.worldofbooks.com/collections/${target}`, target, 120 // Max products
                );
                await this.saveCategoryProducts(target, products);
                await this.scrapeJobRepo.update(scrapeJob.id, {
                    status: 'completed',
                    finished_at: new Date(),
                });
                this.logger.log(`[HIGH] Category ${target} refreshed: ${products.length} products`);
            }
            catch (error) {
                this.logger.error(`[HIGH] Failed to refresh category ${target}:`, error);
                await this.scrapeJobRepo.update(scrapeJob.id, {
                    status: 'failed',
                    finished_at: new Date(),
                    error_log: error.message,
                });
                throw error;
            }
        }
        /**
         * Medium priority: Refresh stale categories (> 24 hours old)
         */
        async handleStaleRefresh(job) {
            this.logger.log('[MEDIUM] Refreshing stale categories');
            // Find categories not scraped in last 24 hours
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
            const staleCategories = await this.categoryRepo.find({
                where: [
                    { last_scraped_at: (0, typeorm_1.LessThan)(twentyFourHoursAgo) },
                    { last_scraped_at: (0, typeorm_1.IsNull)() },
                ],
                take: 5, // Limit to 5 categories per job
            });
            this.logger.log(`[MEDIUM] Found ${staleCategories.length} stale categories`);
            for (const category of staleCategories) {
                try {
                    // Scrape with normal delays
                    const products = await this.categoryScraper.scrape(`https://www.worldofbooks.com/collections/${category.slug}`, category.slug, 40, // Less products for background refresh
                    undefined);
                    await this.saveCategoryProducts(category.slug, products);
                    this.logger.log(`[MEDIUM] Refreshed stale category ${category.slug}: ${products.length} products`);
                    // Small delay between categories
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                catch (error) {
                    this.logger.warn(`[MEDIUM] Failed to refresh stale category ${category.slug}:`, error.message);
                    // Continue with next category
                }
            }
        }
        /**
         * Low priority: Full site scan (all categories)
         */
        async handleFullSiteScan(job) {
            this.logger.log('[LOW] Starting full site scan');
            // Get all categories
            const allCategories = await this.categoryRepo.find({
                select: ['id', 'slug', 'title'],
            });
            this.logger.log(`[LOW] Will scan ${allCategories.length} categories`);
            let processed = 0;
            for (const category of allCategories) {
                try {
                    // Very slow scraping for background (respectful to target site)
                    const products = await this.categoryScraper.scrape(`https://www.worldofbooks.com/collections/${category.slug}`, category.slug, 20, // Very few products for full scan
                    undefined);
                    await this.saveCategoryProducts(category.slug, products);
                    processed++;
                    this.logger.log(`[LOW] Scanned ${category.slug} (${processed}/${allCategories.length}): ${products.length} products`);
                    // Long delay between categories for full scan
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
                catch (error) {
                    this.logger.warn(`[LOW] Failed to scan category ${category.slug}:`, error.message);
                    // Continue with next category
                }
            }
            this.logger.log(`[LOW] Full scan completed: ${processed}/${allCategories.length} categories processed`);
        }
        /**
         * High priority: Navigation refresh
         */
        async handleNavigationRefresh(job) {
            this.logger.log('[HIGH] Refreshing navigation data');
            const scrapeJob = await this.scrapeJobRepo.save({
                target_url: 'https://www.worldofbooks.com',
                target_type: 'navigation',
                status: 'processing',
                started_at: new Date(),
                priority: 'high',
            });
            try {
                const { navigation, categories } = await this.navigationScraper.scrape('https://www.worldofbooks.com');
                // Save navigation
                for (const navItem of navigation) {
                    const existing = await this.navigationRepo.findOne({ where: { slug: navItem.slug } });
                    if (existing) {
                        existing.last_scraped_at = new Date();
                        await this.navigationRepo.save(existing);
                    }
                    else {
                        const newNav = this.navigationRepo.create({
                            title: navItem.title,
                            slug: navItem.slug,
                            last_scraped_at: new Date(),
                        });
                        await this.navigationRepo.save(newNav);
                    }
                }
                // Save categories
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
                await this.scrapeJobRepo.update(scrapeJob.id, {
                    status: 'completed',
                    finished_at: new Date(),
                });
                this.logger.log(`[HIGH] Navigation refreshed: ${navigation.length} nav items, ${categories.length} categories`);
            }
            catch (error) {
                this.logger.error('[HIGH] Failed to refresh navigation:', error);
                await this.scrapeJobRepo.update(scrapeJob.id, {
                    status: 'failed',
                    finished_at: new Date(),
                    error_log: error.message,
                });
                throw error;
            }
        }
        async saveCategoryProducts(categorySlug, products) {
            const category = await this.categoryRepo.findOne({
                where: { slug: categorySlug },
            });
            if (!category) {
                this.logger.warn(`Category ${categorySlug} not found`);
                return;
            }
            let saved = 0;
            let updated = 0;
            for (const productData of products) {
                try {
                    const existingProduct = await this.productRepo.findOne({
                        where: { source_id: productData.source_id },
                    });
                    if (existingProduct) {
                        // Update
                        existingProduct.title = productData.title;
                        existingProduct.price = productData.price;
                        existingProduct.image_url = productData.image_url;
                        existingProduct.last_scraped_at = new Date();
                        await this.productRepo.save(existingProduct);
                        updated++;
                    }
                    else {
                        // Create
                        const newProduct = this.productRepo.create({
                            source_id: productData.source_id,
                            title: productData.title,
                            price: productData.price,
                            currency: productData.currency || 'GBP',
                            image_url: productData.image_url || '',
                            source_url: productData.source_url,
                            category,
                            last_scraped_at: new Date(),
                        });
                        await this.productRepo.save(newProduct);
                        saved++;
                    }
                }
                catch (error) {
                    this.logger.debug(`Failed to save product ${productData.source_id}:`, error.message);
                }
            }
            // Update category stats
            category.product_count = await this.productRepo.count({
                where: { category: { id: category.id } }
            });
            category.last_scraped_at = new Date();
            await this.categoryRepo.save(category);
            this.logger.log(`Saved ${saved} new, updated ${updated} products for ${categorySlug}`);
        }
    };
    __setFunctionName(_classThis, "BackgroundScraperProcessor");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _handleCategoryRefresh_decorators = [(0, bull_1.Process)('refresh-category')];
        _handleStaleRefresh_decorators = [(0, bull_1.Process)('refresh-stale')];
        _handleFullSiteScan_decorators = [(0, bull_1.Process)('full-scan')];
        _handleNavigationRefresh_decorators = [(0, bull_1.Process)('refresh-navigation')];
        __esDecorate(_classThis, null, _handleCategoryRefresh_decorators, { kind: "method", name: "handleCategoryRefresh", static: false, private: false, access: { has: obj => "handleCategoryRefresh" in obj, get: obj => obj.handleCategoryRefresh }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleStaleRefresh_decorators, { kind: "method", name: "handleStaleRefresh", static: false, private: false, access: { has: obj => "handleStaleRefresh" in obj, get: obj => obj.handleStaleRefresh }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleFullSiteScan_decorators, { kind: "method", name: "handleFullSiteScan", static: false, private: false, access: { has: obj => "handleFullSiteScan" in obj, get: obj => obj.handleFullSiteScan }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleNavigationRefresh_decorators, { kind: "method", name: "handleNavigationRefresh", static: false, private: false, access: { has: obj => "handleNavigationRefresh" in obj, get: obj => obj.handleNavigationRefresh }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BackgroundScraperProcessor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BackgroundScraperProcessor = _classThis;
})();
exports.BackgroundScraperProcessor = BackgroundScraperProcessor;
