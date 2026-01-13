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
exports.ProductDetailScraper = void 0;
const common_1 = require("@nestjs/common");
const crawlee_1 = require("crawlee");
const base_scraper_1 = require("./base.scraper");
let ProductDetailScraper = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = base_scraper_1.BaseScraper;
    var ProductDetailScraper = _classThis = class extends _classSuper {
        constructor() {
            super(...arguments);
            this.SELECTORS = {
                DESCRIPTION: '.product-accordion .panel',
                ADDITIONAL_INFO_TABLE: '.additional-info-table',
                INFO_ISBN13: '#info-isbn13',
                INFO_ISBN10: '#info-isbn10',
                INFO_PUBLISHER: '#info-publisher',
                INFO_YEAR_PUBLISHED: '#info-year-published',
                INFO_BINDING_TYPE: '#info-binding-type',
                INFO_CONDITION: '#info-condition',
                INFO_PAGES: '#info-number-of-pages',
                INFO_SKU: '#info-sku',
                RELATED_PRODUCTS: '.algolia-related-products-container .main-product-card',
                RELATED_TITLE: '.card__heading.h5 a',
                RELATED_PRICE: '.price .price-item',
            };
        }
        async scrape(url, sourceId) {
            let productData = {
                source_id: sourceId,
                description: '',
                specs: {},
                reviews: [],
                related_products: [],
            };
            // @ts-ignore - Type issues with Crawlee v3
            const crawler = new crawlee_1.PlaywrightCrawler({
                maxRequestsPerCrawl: 50,
                maxConcurrency: 1,
                requestHandlerTimeoutSecs: 60,
                // @ts-ignore
                failedRequestHandler: async ({ request, error }) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Request ${request.url} failed: ${errorMessage}`);
                },
                launchContext: {
                    launchOptions: {
                        headless: true,
                    },
                },
                useSessionPool: true,
                persistCookiesPerSession: true,
                maxRequestRetries: this.MAX_RETRIES,
                retryOnBlocked: true,
                // @ts-ignore - Main handler
                requestHandler: async ({ page, request }) => {
                    this.logger.log(`Scraping product detail: ${sourceId} from ${request.url}`);
                    await page.waitForSelector('body', { timeout: 10000 });
                    await this.delay();
                    // Extract description
                    try {
                        const descriptionElement = await page.$(this.SELECTORS.DESCRIPTION);
                        if (descriptionElement) {
                            const descriptionText = await descriptionElement.textContent();
                            productData.description = descriptionText?.trim() || '';
                            // Extract reviews from description
                            productData.reviews = this.extractReviewFromDescription(productData.description);
                        }
                    }
                    catch (error) {
                        this.logger.warn(`Failed to extract description: ${error.message}`);
                    }
                    // Extract additional information/specs
                    try {
                        const tableExists = await page.$(this.SELECTORS.ADDITIONAL_INFO_TABLE);
                        if (tableExists) {
                            productData.specs = {
                                isbn13: await this.extractTableValue(page, this.SELECTORS.INFO_ISBN13),
                                isbn10: await this.extractTableValue(page, this.SELECTORS.INFO_ISBN10),
                                publisher: await this.extractTableValue(page, this.SELECTORS.INFO_PUBLISHER),
                                year_published: await this.extractTableValue(page, this.SELECTORS.INFO_YEAR_PUBLISHED),
                                binding_type: await this.extractTableValue(page, this.SELECTORS.INFO_BINDING_TYPE),
                                condition: await this.extractTableValue(page, this.SELECTORS.INFO_CONDITION),
                                pages: parseInt(await this.extractTableValue(page, this.SELECTORS.INFO_PAGES) || '0'),
                                sku: await this.extractTableValue(page, this.SELECTORS.INFO_SKU),
                            };
                        }
                    }
                    catch (error) {
                        this.logger.warn(`Failed to extract specs: ${error.message}`);
                    }
                    // Extract related products
                    try {
                        const relatedElements = await page.$$(this.SELECTORS.RELATED_PRODUCTS);
                        for (const relatedEl of relatedElements) {
                            try {
                                const titleElement = await relatedEl.$(this.SELECTORS.RELATED_TITLE);
                                const priceElement = await relatedEl.$(this.SELECTORS.RELATED_PRICE);
                                const title = await titleElement?.textContent();
                                const priceText = await priceElement?.textContent();
                                const productUrl = await titleElement?.getAttribute('href');
                                if (title && productUrl) {
                                    const relatedSourceId = this.extractSourceIdFromUrl(productUrl);
                                    const { amount: price } = this.normalizePrice(priceText || '');
                                    const fullUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
                                    productData.related_products.push({
                                        source_id: relatedSourceId,
                                        title: title.trim(),
                                        url: fullUrl,
                                        price,
                                    });
                                }
                            }
                            catch (error) {
                                // Skip individual related product errors
                            }
                        }
                    }
                    catch (error) {
                        this.logger.warn(`Failed to extract related products: ${error.message}`);
                    }
                    this.logger.log(`Successfully scraped detail for: ${sourceId}`);
                    this.logger.debug(`Found ${productData.reviews.length} reviews and ${productData.related_products.length} related products`);
                },
            });
            await crawler.run([{
                    url,
                    uniqueKey: `product-detail-${sourceId}`,
                    label: 'product-detail',
                    userData: { sourceId }
                }]);
            return productData;
        }
        async extractTableValue(page, selector) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    return text?.trim() || '';
                }
            }
            catch (error) {
                // Return empty if element not found
            }
            return '';
        }
        extractSourceIdFromUrl(url) {
            const isbnMatch = url.match(/\d{10,13}/);
            if (isbnMatch) {
                return `WOB-ISBN-${isbnMatch[0]}`;
            }
            return `WOB-REL-${Buffer.from(url).toString('base64').substring(0, 15)}`;
        }
    };
    __setFunctionName(_classThis, "ProductDetailScraper");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProductDetailScraper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProductDetailScraper = _classThis;
})();
exports.ProductDetailScraper = ProductDetailScraper;
