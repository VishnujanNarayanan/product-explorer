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
exports.CoreController = void 0;
const common_1 = require("@nestjs/common");
let CoreController = (() => {
    let _classDecorators = [(0, common_1.Controller)('api')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _getNavigation_decorators;
    let _getCategories_decorators;
    let _getCategory_decorators;
    let _getCategoryProducts_decorators;
    let _getProduct_decorators;
    let _scrapeNavigation_decorators;
    let _scrapeCategory_decorators;
    let _scrapeProduct_decorators;
    let _triggerScrape_decorators;
    let _getJobStatus_decorators;
    let _cleanupData_decorators;
    let _clearCache_decorators;
    let _test_decorators;
    let _testScrape_decorators;
    let _healthCheck_decorators;
    var CoreController = _classThis = class {
        constructor(coreService, scraperService) {
            this.coreService = (__runInitializers(this, _instanceExtraInitializers), coreService);
            this.scraperService = scraperService;
            this.logger = new common_1.Logger(CoreController.name);
        }
        async getNavigation() {
            try {
                // First check if we have data
                const navItems = await this.coreService.getNavigation();
                // If no data, trigger scrape
                if (navItems.length === 0) {
                    this.logger.log('No navigation data found, triggering scrape...');
                    return this.scraperService.scrapeAndSaveNavigation();
                }
                return navItems;
            }
            catch (error) {
                this.logger.error(`Navigation error: ${error.message}`);
                throw new common_1.InternalServerErrorException('Failed to load navigation');
            }
        }
        async getCategories(navigationSlug) {
            try {
                if (navigationSlug) {
                    return this.coreService.getCategoriesByNavigation(navigationSlug);
                }
                // Return all categories
                return this.coreService.getAllCategories();
            }
            catch (error) {
                this.logger.error(`Categories error: ${error.message}`);
                throw new common_1.InternalServerErrorException('Failed to load categories');
            }
        }
        async getCategory(slug) {
            try {
                return this.coreService.getCategoryBySlug(slug);
            }
            catch (error) {
                this.logger.error(`Category error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to load category: ${slug}`);
            }
        }
        async getCategoryProducts(slug) {
            try {
                return this.scraperService.scrapeCategoryBySlug(slug);
            }
            catch (error) {
                this.logger.error(`Category products error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to load products for category: ${slug}`);
            }
        }
        async getProduct(sourceId, refresh) {
            try {
                const forceRefresh = refresh === 'true';
                return this.scraperService.scrapeProductBySourceId(sourceId, forceRefresh);
            }
            catch (error) {
                this.logger.error(`Product error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to load product: ${sourceId}`);
            }
        }
        // ========== NEW CLEAN SCRAPE ENDPOINTS ==========
        async scrapeNavigation() {
            try {
                this.logger.log('Manual navigation scrape triggered via API');
                const result = await this.scraperService.scrapeAndSaveNavigation();
                return {
                    success: true,
                    message: `Navigation scraping completed. Found ${result.length} navigation items.`,
                    data: result
                };
            }
            catch (error) {
                this.logger.error(`Navigation scrape error: ${error.message}`);
                throw new common_1.InternalServerErrorException('Failed to scrape navigation');
            }
        }
        async scrapeCategory(slug) {
            try {
                this.logger.log(`Manual category scrape triggered via API: ${slug}`);
                return this.scraperService.scrapeCategoryBySlug(slug);
            }
            catch (error) {
                this.logger.error(`Category scrape error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to scrape category: ${slug}`);
            }
        }
        async scrapeProduct(sourceId, body) {
            try {
                this.logger.log(`Manual product scrape triggered via API: ${sourceId}`);
                const forceRefresh = body?.refresh || false;
                const product = await this.scraperService.scrapeProductBySourceId(sourceId, forceRefresh);
                if (!product) {
                    return {
                        success: false,
                        message: `Product not found: ${sourceId}`,
                        data: null,
                        hasDetails: false,
                        jobQueued: false
                    };
                }
                return {
                    success: true,
                    message: `Product ${forceRefresh ? 're-scraped' : 'loaded'} successfully`,
                    data: product,
                    hasDetails: !!product.detail,
                    jobQueued: forceRefresh || !product.detail
                };
            }
            catch (error) {
                this.logger.error(`Product scrape error: ${error.message}`);
                // Return structured error response
                return {
                    success: false,
                    message: `Failed to scrape product: ${sourceId}`,
                    error: error.message,
                    data: null,
                    hasDetails: false,
                    jobQueued: false
                };
            }
        }
        // ========== LEGACY ENDPOINT (for backward compatibility) ==========
        async triggerScrape(type, target) {
            try {
                this.logger.log(`Legacy scrape endpoint called: ${type}/${target}`);
                // Map to appropriate methods
                switch (type) {
                    case 'navigation':
                        // For navigation, target can be ignored or used as URL
                        const url = target === 'home' || target === 'all' ?
                            'https://www.worldofbooks.com' : target;
                        return this.scraperService.triggerOnDemandScrape(type, url);
                    case 'category':
                        return this.scraperService.triggerOnDemandScrape(type, target);
                    case 'product':
                        return this.scraperService.triggerOnDemandScrape(type, target);
                    default:
                        throw new Error(`Unknown scrape type: ${type}`);
                }
            }
            catch (error) {
                this.logger.error(`Scrape trigger error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to trigger scrape: ${type}/${target}`);
            }
        }
        // ========== UTILITY ENDPOINTS ==========
        async getJobStatus(id) {
            try {
                return this.scraperService.getScrapeJobStatus(parseInt(id));
            }
            catch (error) {
                this.logger.error(`Job status error: ${error.message}`);
                throw new common_1.InternalServerErrorException(`Failed to get job status: ${id}`);
            }
        }
        async cleanupData() {
            try {
                return this.scraperService.cleanupOldData();
            }
            catch (error) {
                this.logger.error(`Cleanup error: ${error.message}`);
                throw new common_1.InternalServerErrorException('Failed to cleanup data');
            }
        }
        async clearCache() {
            try {
                await this.scraperService.clearCache();
                return {
                    success: true,
                    message: 'Cache cleared successfully',
                    timestamp: new Date()
                };
            }
            catch (error) {
                this.logger.error(`Cache clear error: ${error.message}`);
                throw new common_1.InternalServerErrorException('Failed to clear cache');
            }
        }
        async test() {
            return {
                status: 'OK',
                timestamp: new Date(),
                message: 'Backend is working',
                endpoints: {
                    scrapeNavigation: 'POST /api/scrape/navigation',
                    scrapeCategory: 'POST /api/scrape/category/{slug}',
                    scrapeProduct: 'POST /api/scrape/product/{sourceId}',
                    getNavigation: 'GET /api/navigation',
                    getCategories: 'GET /api/categories',
                    clearCache: 'POST /api/cache/clear'
                }
            };
        }
        async testScrape() {
            try {
                // Simple test without database
                return {
                    success: true,
                    message: 'Scraper test endpoint',
                    time: new Date()
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        }
        async healthCheck() {
            return this.coreService.healthCheck();
        }
    };
    __setFunctionName(_classThis, "CoreController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getNavigation_decorators = [(0, common_1.Get)('navigation')];
        _getCategories_decorators = [(0, common_1.Get)('categories')];
        _getCategory_decorators = [(0, common_1.Get)('categories/:slug')];
        _getCategoryProducts_decorators = [(0, common_1.Get)('categories/:slug/products')];
        _getProduct_decorators = [(0, common_1.Get)('products/:id')];
        _scrapeNavigation_decorators = [(0, common_1.Post)('scrape/navigation')];
        _scrapeCategory_decorators = [(0, common_1.Post)('scrape/category/:slug')];
        _scrapeProduct_decorators = [(0, common_1.Post)('scrape/product/:sourceId')];
        _triggerScrape_decorators = [(0, common_1.Post)('scrape/:type/:target')];
        _getJobStatus_decorators = [(0, common_1.Get)('jobs/:id')];
        _cleanupData_decorators = [(0, common_1.Post)('cleanup')];
        _clearCache_decorators = [(0, common_1.Post)('cache/clear')];
        _test_decorators = [(0, common_1.Get)('test')];
        _testScrape_decorators = [(0, common_1.Get)('test-scrape')];
        _healthCheck_decorators = [(0, common_1.Get)('health')];
        __esDecorate(_classThis, null, _getNavigation_decorators, { kind: "method", name: "getNavigation", static: false, private: false, access: { has: obj => "getNavigation" in obj, get: obj => obj.getNavigation }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCategories_decorators, { kind: "method", name: "getCategories", static: false, private: false, access: { has: obj => "getCategories" in obj, get: obj => obj.getCategories }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCategory_decorators, { kind: "method", name: "getCategory", static: false, private: false, access: { has: obj => "getCategory" in obj, get: obj => obj.getCategory }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getCategoryProducts_decorators, { kind: "method", name: "getCategoryProducts", static: false, private: false, access: { has: obj => "getCategoryProducts" in obj, get: obj => obj.getCategoryProducts }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getProduct_decorators, { kind: "method", name: "getProduct", static: false, private: false, access: { has: obj => "getProduct" in obj, get: obj => obj.getProduct }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _scrapeNavigation_decorators, { kind: "method", name: "scrapeNavigation", static: false, private: false, access: { has: obj => "scrapeNavigation" in obj, get: obj => obj.scrapeNavigation }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _scrapeCategory_decorators, { kind: "method", name: "scrapeCategory", static: false, private: false, access: { has: obj => "scrapeCategory" in obj, get: obj => obj.scrapeCategory }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _scrapeProduct_decorators, { kind: "method", name: "scrapeProduct", static: false, private: false, access: { has: obj => "scrapeProduct" in obj, get: obj => obj.scrapeProduct }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _triggerScrape_decorators, { kind: "method", name: "triggerScrape", static: false, private: false, access: { has: obj => "triggerScrape" in obj, get: obj => obj.triggerScrape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getJobStatus_decorators, { kind: "method", name: "getJobStatus", static: false, private: false, access: { has: obj => "getJobStatus" in obj, get: obj => obj.getJobStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _cleanupData_decorators, { kind: "method", name: "cleanupData", static: false, private: false, access: { has: obj => "cleanupData" in obj, get: obj => obj.cleanupData }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _clearCache_decorators, { kind: "method", name: "clearCache", static: false, private: false, access: { has: obj => "clearCache" in obj, get: obj => obj.clearCache }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _test_decorators, { kind: "method", name: "test", static: false, private: false, access: { has: obj => "test" in obj, get: obj => obj.test }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _testScrape_decorators, { kind: "method", name: "testScrape", static: false, private: false, access: { has: obj => "testScrape" in obj, get: obj => obj.testScrape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _healthCheck_decorators, { kind: "method", name: "healthCheck", static: false, private: false, access: { has: obj => "healthCheck" in obj, get: obj => obj.healthCheck }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CoreController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CoreController = _classThis;
})();
exports.CoreController = CoreController;
