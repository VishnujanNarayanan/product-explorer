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
exports.ScraperModule = void 0;
// backend/src/modules/scraper/scraper.module.ts
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const cache_manager_1 = require("@nestjs/cache-manager");
const cache_manager_redis_store_1 = require("cache-manager-redis-store");
const typeorm_1 = require("@nestjs/typeorm");
const scraper_service_1 = require("./scraper.service");
const scraper_session_service_1 = require("./scraper-session.service");
const scrape_processor_1 = require("./processors/scrape.processor");
const background_processor_1 = require("./processors/background.processor");
const navigation_scraper_1 = require("./scrapers/navigation.scraper");
const category_scraper_1 = require("./scrapers/category.scraper");
const product_scraper_1 = require("./scrapers/product.scraper");
const product_detail_scraper_1 = require("./scrapers/product-detail.scraper");
const interactive_scraper_1 = require("./scrapers/interactive.scraper");
const navigation_entity_1 = require("../../entities/navigation.entity");
const category_entity_1 = require("../../entities/category.entity");
const product_entity_1 = require("../../entities/product.entity");
const product_detail_entity_1 = require("../../entities/product-detail.entity");
const review_entity_1 = require("../../entities/review.entity");
const scrape_job_entity_1 = require("../../entities/scrape-job.entity");
const scraper_session_entity_1 = require("../../entities/scraper-session.entity");
const view_history_entity_1 = require("../../entities/view-history.entity");
let ScraperModule = (() => {
    let _classDecorators = [(0, common_1.Module)({
            imports: [
                typeorm_1.TypeOrmModule.forFeature([
                    navigation_entity_1.Navigation,
                    category_entity_1.Category,
                    product_entity_1.Product,
                    product_detail_entity_1.ProductDetail,
                    review_entity_1.Review,
                    scrape_job_entity_1.ScrapeJob,
                    scraper_session_entity_1.ScraperSession,
                    view_history_entity_1.ViewHistory,
                ]),
                bull_1.BullModule.registerQueue({
                    name: 'scraping',
                    redis: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                    },
                    defaultJobOptions: {
                        removeOnComplete: true,
                        removeOnFail: false,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                    },
                }),
                bull_1.BullModule.registerQueue({
                    name: 'background-scraping',
                    redis: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                    },
                    defaultJobOptions: {
                        removeOnComplete: true,
                        removeOnFail: false,
                        attempts: 2,
                        backoff: {
                            type: 'fixed',
                            delay: 10000,
                        },
                        priority: 1, // Lower priority than real-time scraping
                    },
                }),
                cache_manager_1.CacheModule.registerAsync({
                    useFactory: async () => ({
                        store: cache_manager_redis_store_1.redisStore,
                        host: process.env.REDIS_HOST || 'localhost',
                        port: parseInt(process.env.REDIS_PORT || '6379'),
                        ttl: parseInt(process.env.CACHE_TTL || '86400'), // 24 hours
                        max: 1000, // Maximum number of items in cache
                    }),
                }),
            ],
            providers: [
                // Core Services
                scraper_service_1.ScraperService,
                scraper_session_service_1.ScraperSessionService,
                // Queue Processors
                scrape_processor_1.ScrapeProcessor,
                background_processor_1.BackgroundScraperProcessor,
                // Scrapers
                navigation_scraper_1.NavigationScraper,
                category_scraper_1.CategoryScraper,
                product_scraper_1.ProductScraper,
                product_detail_scraper_1.ProductDetailScraper,
                interactive_scraper_1.InteractiveScraper,
            ],
            exports: [
                scraper_service_1.ScraperService,
                scraper_session_service_1.ScraperSessionService,
                navigation_scraper_1.NavigationScraper,
                category_scraper_1.CategoryScraper,
                product_scraper_1.ProductScraper,
                product_detail_scraper_1.ProductDetailScraper,
                interactive_scraper_1.InteractiveScraper,
            ],
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ScraperModule = _classThis = class {
    };
    __setFunctionName(_classThis, "ScraperModule");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScraperModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScraperModule = _classThis;
})();
exports.ScraperModule = ScraperModule;
