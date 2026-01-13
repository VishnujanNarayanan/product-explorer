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
exports.ScraperSessionService = void 0;
// backend/src/modules/scraper/scraper-session.service.ts (COMPLETE VERSION)
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ScraperSessionService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ScraperSessionService = _classThis = class {
        constructor(sessionRepo, productRepo, categoryRepo, navigationRepo, interactiveScraper, backgroundQueue) {
            this.sessionRepo = sessionRepo;
            this.productRepo = productRepo;
            this.categoryRepo = categoryRepo;
            this.navigationRepo = navigationRepo;
            this.interactiveScraper = interactiveScraper;
            this.backgroundQueue = backgroundQueue;
            this.logger = new common_1.Logger(ScraperSessionService.name);
            this.activeSessions = new Map();
            this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
            // Start cleanup interval
            setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
        }
        async createSession(sessionId) {
            this.logger.log(`Creating interactive scraper session: ${sessionId}`);
            try {
                const { browser, context, page } = await this.interactiveScraper.initializeBrowser();
                await this.interactiveScraper.navigateToHomepage(page);
                const session = {
                    browser,
                    context,
                    page,
                    lastActivity: new Date(),
                    currentUrl: page.url(),
                    productsScraped: 0,
                };
                this.activeSessions.set(sessionId, session);
                // Save to database
                await this.sessionRepo.save({
                    session_id: sessionId,
                    current_url: session.currentUrl,
                    status: 'active',
                    stats: {
                        total_products_scraped: 0,
                        load_more_count: 0,
                    },
                });
                this.logger.log(`Session ${sessionId} created successfully`);
            }
            catch (error) {
                this.logger.error(`Failed to create session ${sessionId}:`, error);
                throw new Error(`Failed to initialize interactive scraper: ${error.message}`);
            }
        }
        async handleHover(sessionId, target, navigationSlug) {
            this.updateActivity(sessionId);
            const session = this.getSession(sessionId);
            try {
                const hovered = await this.interactiveScraper.hoverNavigation(session.page, target, navigationSlug);
                return {
                    products: [],
                    status: hovered ? 'success' : 'partial',
                    message: hovered ? `Hovered over ${target}` : `Could not hover over ${target}`,
                    totalScraped: 0,
                    hasMore: false,
                };
            }
            catch (error) {
                this.logger.error(`Hover failed for ${sessionId}:`, error);
                return {
                    products: [],
                    status: 'failed',
                    message: `Hover failed: ${error.message}`,
                    totalScraped: 0,
                    hasMore: false,
                };
            }
        }
        async handleClick(sessionId, target, categorySlug, navigationSlug) {
            this.updateActivity(sessionId);
            const session = this.getSession(sessionId);
            try {
                // First check cache
                const cachedProducts = await this.getCachedProducts(categorySlug, 120);
                if (cachedProducts.length > 0) {
                    this.logger.log(`Returning ${cachedProducts.length} cached products for ${categorySlug}`);
                    return {
                        products: cachedProducts,
                        status: 'success',
                        message: `Loaded ${cachedProducts.length} cached products`,
                        totalScraped: cachedProducts.length,
                        hasMore: cachedProducts.length >= 120,
                    };
                }
                // Hover navigation if provided
                if (navigationSlug) {
                    await this.interactiveScraper.hoverNavigation(session.page, navigationSlug);
                }
                // Click category
                const clicked = await this.interactiveScraper.clickCategory(session.page, target, categorySlug);
                if (!clicked) {
                    throw new Error(`Failed to click category ${categorySlug}`);
                }
                // Scrape first batch
                const products = await this.interactiveScraper.scrapeProductsFromPage(session.page, categorySlug, 40);
                // Update session state
                session.categorySlug = categorySlug;
                session.productsScraped = products.length;
                session.currentUrl = session.page.url();
                // Save to cache
                if (products.length > 0) {
                    await this.saveProductsToCache(categorySlug, products);
                    // Queue background refresh for other categories
                    await this.queueBackgroundRefresh(categorySlug);
                }
                // Check if more products available
                const hasMore = await this.interactiveScraper.clickLoadMore(session.page);
                return {
                    products,
                    status: 'success',
                    message: `Scraped ${products.length} products from ${categorySlug}`,
                    totalScraped: products.length,
                    hasMore,
                };
            }
            catch (error) {
                this.logger.error(`Click failed for ${sessionId}:`, error);
                return {
                    products: [],
                    status: 'failed',
                    message: `Click failed: ${error.message}`,
                    totalScraped: 0,
                    hasMore: false,
                };
            }
        }
        async handleLoadMore(sessionId, target, categorySlug) {
            this.updateActivity(sessionId);
            const session = this.getSession(sessionId);
            try {
                // Click load more
                const clicked = await this.interactiveScraper.clickLoadMore(session.page);
                if (!clicked) {
                    return {
                        products: [],
                        status: 'partial',
                        message: 'No more products to load',
                        totalScraped: session.productsScraped,
                        hasMore: false,
                    };
                }
                // Scrape new products
                const newProducts = await this.interactiveScraper.scrapeProductsFromPage(session.page, categorySlug, 40);
                // Update counts
                session.productsScraped += newProducts.length;
                // Save to cache
                if (newProducts.length > 0) {
                    await this.saveProductsToCache(categorySlug, newProducts);
                }
                // Check if still more available
                const hasMore = await this.interactiveScraper.clickLoadMore(session.page);
                // Update session stats
                await this.updateSessionStats(sessionId, {
                    load_more_count: (session.productsScraped / 40) - 1,
                    total_products_scraped: session.productsScraped,
                });
                return {
                    products: newProducts,
                    status: 'success',
                    message: `Loaded ${newProducts.length} more products`,
                    totalScraped: session.productsScraped,
                    hasMore,
                };
            }
            catch (error) {
                this.logger.error(`Load more failed for ${sessionId}:`, error);
                return {
                    products: [],
                    status: 'failed',
                    message: `Load more failed: ${error.message}`,
                    totalScraped: session.productsScraped,
                    hasMore: false,
                };
            }
        }
        async getProductDetails(sessionId, sourceId) {
            this.updateActivity(sessionId);
            // Check cache first
            const cachedProduct = await this.productRepo.findOne({
                where: { source_id: sourceId },
                relations: ['detail', 'reviews', 'category'],
            });
            if (cachedProduct?.detail) {
                return cachedProduct;
            }
            // Get from session
            const session = this.getSession(sessionId);
            const product = await this.productRepo.findOne({
                where: { source_id: sourceId },
            });
            if (!product) {
                throw new Error(`Product ${sourceId} not found`);
            }
            // Navigate and scrape details
            const details = await this.interactiveScraper.getProductDetails(session.page, product.source_url);
            // Update product in database
            await this.updateProductWithDetails(sourceId, details);
            // Get updated product
            return await this.productRepo.findOne({
                where: { source_id: sourceId },
                relations: ['detail', 'reviews', 'category'],
            });
        }
        getSession(sessionId) {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found or expired`);
            }
            return session;
        }
        async getCachedProducts(categorySlug, limit) {
            const category = await this.categoryRepo.findOne({
                where: { slug: categorySlug },
            });
            if (!category) {
                return [];
            }
            const products = await this.productRepo.find({
                where: { category: { id: category.id } },
                relations: ['category'],
                order: { last_scraped_at: 'DESC' },
                take: limit,
            });
            return products;
        }
        async saveProductsToCache(categorySlug, products) {
            const category = await this.categoryRepo.findOne({
                where: { slug: categorySlug },
            });
            if (!category) {
                this.logger.warn(`Category ${categorySlug} not found for caching`);
                return;
            }
            for (const productData of products) {
                const existing = await this.productRepo.findOne({
                    where: { source_id: productData.source_id },
                });
                if (existing) {
                    // Update
                    existing.title = productData.title;
                    existing.price = productData.price;
                    existing.image_url = productData.image_url;
                    existing.last_scraped_at = new Date();
                    await this.productRepo.save(existing);
                }
                else {
                    // Create
                    const product = this.productRepo.create({
                        source_id: productData.source_id,
                        title: productData.title,
                        price: productData.price,
                        currency: productData.currency || 'GBP',
                        image_url: productData.image_url || '',
                        source_url: productData.source_url,
                        category,
                        last_scraped_at: new Date(),
                    });
                    await this.productRepo.save(product);
                }
            }
            // Update category count
            category.product_count = await this.productRepo.count({
                where: { category: { id: category.id } },
            });
            category.last_scraped_at = new Date();
            await this.categoryRepo.save(category);
            this.logger.log(`Cached ${products.length} products for ${categorySlug}`);
        }
        async queueBackgroundRefresh(currentCategorySlug) {
            // Get all other categories
            const allCategories = await this.categoryRepo.find({
                where: { slug: (0, typeorm_1.Not)(currentCategorySlug) },
                take: 10,
            });
            for (const category of allCategories) {
                await this.backgroundQueue.add('refresh-stale', {
                    type: 'refresh-stale',
                    target: category.slug,
                    priority: 'low',
                    triggeredBy: 'user-interaction',
                });
            }
        }
        async updateProductWithDetails(sourceId, details) {
            // Implementation depends on your product detail structure
            this.logger.log(`Updating details for product ${sourceId}`);
        }
        async updateSessionStats(sessionId, stats) {
            await this.sessionRepo.update({ session_id: sessionId }, { stats, last_active: new Date() });
        }
        updateActivity(sessionId) {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                session.lastActivity = new Date();
            }
        }
        async cleanupSession(sessionId) {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                try {
                    await session.page.close();
                    await session.context.close();
                    await session.browser.close();
                    this.activeSessions.delete(sessionId);
                    // Update database
                    await this.sessionRepo.update({ session_id: sessionId }, { status: 'terminated', last_active: new Date() });
                    this.logger.log(`Cleaned up session ${sessionId}`);
                }
                catch (error) {
                    this.logger.error(`Failed to cleanup session ${sessionId}:`, error);
                }
            }
        }
        async cleanupInactiveSessions() {
            const now = new Date();
            for (const [sessionId, session] of this.activeSessions.entries()) {
                const inactiveTime = now.getTime() - session.lastActivity.getTime();
                if (inactiveTime > this.sessionTimeout) {
                    this.logger.log(`Cleaning up inactive session ${sessionId} (${Math.round(inactiveTime / 60000)}m inactive)`);
                    await this.cleanupSession(sessionId);
                }
            }
        }
        async onModuleDestroy() {
            const cleanupPromises = Array.from(this.activeSessions.keys()).map(sessionId => this.cleanupSession(sessionId));
            await Promise.allSettled(cleanupPromises);
        }
    };
    __setFunctionName(_classThis, "ScraperSessionService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScraperSessionService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScraperSessionService = _classThis;
})();
exports.ScraperSessionService = ScraperSessionService;
