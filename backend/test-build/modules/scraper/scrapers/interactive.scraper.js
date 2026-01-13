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
exports.InteractiveScraper = void 0;
// backend/src/modules/scraper/scrapers/interactive.scraper.ts
const common_1 = require("@nestjs/common");
const playwright = require("playwright");
const base_scraper_1 = require("./base.scraper");
let InteractiveScraper = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = base_scraper_1.BaseScraper;
    var InteractiveScraper = _classThis = class extends _classSuper {
        constructor() {
            super(...arguments);
            this.logger = new common_1.Logger(InteractiveScraper.name);
            this.SELECTORS = {
                // Navigation
                NAV_MENU: 'nav, .nav, .header-nav, [data-menu]',
                NAV_ITEM: 'a[href*="/pages/"], a[href*="/collections/"], [data-menu_category]',
                CATEGORY_LINK: 'a[data-menu_subcategory], .subcategory-link',
                // Product Grid
                PRODUCT_GRID: '.plp-listing, .product-grid, .collection-products',
                PRODUCT_CARD: '.main-product-card, .product-card, .grid-item',
                PRODUCT_TITLE: '.card__heading a, .product-title a, .title a',
                PRODUCT_AUTHOR: '.truncate-author, .author, .product-author',
                PRODUCT_PRICE: '.price-item, .price, .product-price',
                PRODUCT_IMAGE: '.card__media img, .product-image img, img[src*="products"]',
                // Pagination
                LOAD_MORE: '#custom-load-more, .load-more, [aria-label="Load more"]',
                PAGINATION: '.pagination, .page-numbers, .paginate',
                NEXT_PAGE: 'a[rel="next"], .next-page, .pagination-next',
                // Product Details
                PRODUCT_DETAIL: '.product-accordion, .product-description, #product-description',
                DESCRIPTION: '.description, .product-info, .product-details',
                SPECS_TABLE: '.additional-info-table, .specs-table, .product-specs',
                // Cookies
                COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter, .cookie-banner',
                COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"], .accept-cookies',
            };
        }
        async initializeBrowser() {
            this.logger.log('Initializing Playwright browser for interactive session');
            const browser = await playwright.chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ],
            });
            const context = await browser.newContext({
                userAgent: this.USER_AGENT,
                viewport: { width: 1920, height: 1080 },
                javaScriptEnabled: true,
                ignoreHTTPSErrors: true,
            });
            const page = await context.newPage();
            // Set navigation timeout
            page.setDefaultNavigationTimeout(30000);
            page.setDefaultTimeout(15000);
            // Intercept requests to block unnecessary resources
            await page.route('**/*.{png,jpg,jpeg,gif,css,woff,woff2,ttf,eot,svg}', route => route.abort());
            return { browser, context, page };
        }
        async navigateToHomepage(page) {
            this.logger.log('Navigating to World of Books homepage');
            await page.goto('https://www.worldofbooks.com', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            await this.handleCookieConsent(page);
            await this.delay(2000);
            this.logger.log('Homepage loaded successfully');
        }
        async hoverNavigation(page, target, navigationSlug) {
            this.logger.log(`Attempting to hover over navigation: ${target}`);
            try {
                // Map slugs to text
                const navMap = {
                    'fiction-books': 'Fiction Books',
                    'non-fiction-books': 'Non-Fiction Books',
                    'childrens-books': 'Children\'s Books',
                    'rare-books': 'Rare Books',
                    'music-film': 'Music & Film',
                };
                const searchText = navMap[target] || target;
                // Try to find navigation element
                const navElements = await page.$$(this.SELECTORS.NAV_ITEM);
                let hovered = false;
                for (const element of navElements) {
                    const text = await element.textContent();
                    const href = await element.getAttribute('href');
                    if (text && (text.includes(searchText) || href?.includes(target))) {
                        await element.hover();
                        await this.delay(1000); // Wait for menu to appear
                        this.logger.log(`Hovered over navigation: ${text.trim()}`);
                        hovered = true;
                        break;
                    }
                }
                if (!hovered) {
                    // Alternative: try data attributes
                    const dataNavElements = await page.$$('[data-menu_category]');
                    for (const element of dataNavElements) {
                        const dataAttr = await element.getAttribute('data-menu_category');
                        if (dataAttr && dataAttr.includes(searchText)) {
                            await element.hover();
                            await this.delay(1000);
                            hovered = true;
                            break;
                        }
                    }
                }
                return hovered;
            }
            catch (error) {
                this.logger.warn(`Hover failed for ${target}:`, error.message);
                return false;
            }
        }
        async clickCategory(page, target, categorySlug) {
            this.logger.log(`Attempting to click category: ${categorySlug}`);
            try {
                // First try: data-menu_subcategory attribute
                const categoryLinks = await page.$$(this.SELECTORS.CATEGORY_LINK);
                for (const link of categoryLinks) {
                    const href = await link.getAttribute('href');
                    const dataSubcategory = await link.getAttribute('data-menu_subcategory');
                    if (href && href.includes(categorySlug)) {
                        await link.click();
                        await page.waitForLoadState('networkidle');
                        await this.delay(2000);
                        this.logger.log(`Clicked category via href: ${categorySlug}`);
                        return true;
                    }
                    if (dataSubcategory && dataSubcategory.toLowerCase().includes(categorySlug.toLowerCase())) {
                        await link.click();
                        await page.waitForLoadState('networkidle');
                        await this.delay(2000);
                        this.logger.log(`Clicked category via data attribute: ${categorySlug}`);
                        return true;
                    }
                }
                // Second try: direct navigation
                this.logger.log(`Falling back to direct navigation for ${categorySlug}`);
                await page.goto(`https://www.worldofbooks.com/collections/${categorySlug}`, {
                    waitUntil: 'networkidle',
                });
                await this.delay(2000);
                return true;
            }
            catch (error) {
                this.logger.error(`Failed to click category ${categorySlug}:`, error);
                return false;
            }
        }
        async scrapeProductsFromPage(page, categorySlug, maxProducts = 40) {
            const products = [];
            try {
                // Wait for product grid
                await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 10000 });
                await this.delay(1000);
                // Get all product cards
                const productElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
                this.logger.log(`Found ${productElements.length} product cards on page`);
                for (const productEl of productElements) {
                    try {
                        const product = await this.extractProductFromElement(productEl, categorySlug);
                        if (product) {
                            products.push(product);
                            // Stop if we reached max products
                            if (products.length >= maxProducts) {
                                break;
                            }
                        }
                    }
                    catch (error) {
                        // Skip failed products
                    }
                }
                this.logger.log(`Successfully extracted ${products.length} products`);
            }
            catch (error) {
                this.logger.warn(`Failed to scrape products:`, error.message);
            }
            return products;
        }
        async clickLoadMore(page) {
            try {
                const loadMoreBtn = await page.$(this.SELECTORS.LOAD_MORE);
                if (!loadMoreBtn) {
                    this.logger.debug('Load More button not found');
                    return false;
                }
                // Check if button is visible and enabled
                const isVisible = await loadMoreBtn.evaluate((el) => {
                    return el.offsetParent !== null && !el.hasAttribute('disabled');
                });
                if (!isVisible) {
                    this.logger.debug('Load More button not visible or disabled');
                    return false;
                }
                // Scroll and click
                await loadMoreBtn.scrollIntoViewIfNeeded();
                await this.delay(500);
                await loadMoreBtn.click();
                await this.delay(3000); // Wait for new products to load
                this.logger.log('Clicked Load More button');
                return true;
            }
            catch (error) {
                this.logger.debug('Failed to click Load More:', error.message);
                return false;
            }
        }
        async extractProductFromElement(element, categorySlug) {
            try {
                // Title and URL
                const titleEl = await element.$(this.SELECTORS.PRODUCT_TITLE);
                if (!titleEl)
                    return null;
                const title = await titleEl.textContent();
                const productUrl = await titleEl.getAttribute('href');
                if (!title || !productUrl)
                    return null;
                // Author
                const authorEl = await element.$(this.SELECTORS.PRODUCT_AUTHOR);
                const author = authorEl ? await authorEl.textContent() : 'Unknown';
                // Price
                const priceEl = await element.$(this.SELECTORS.PRODUCT_PRICE);
                const priceText = priceEl ? await priceEl.textContent() : '';
                const { amount: price, currency } = this.normalizePrice(priceText || '');
                // Image
                const imageEl = await element.$(this.SELECTORS.PRODUCT_IMAGE);
                const imageUrl = imageEl ? await imageEl.getAttribute('src') : '';
                // Source ID
                const sourceId = this.extractSourceId(productUrl);
                const fullUrl = productUrl.startsWith('http') ? productUrl : `https://www.worldofbooks.com${productUrl}`;
                return {
                    source_id: sourceId,
                    title: title.trim(),
                    author: author?.trim() || 'Unknown',
                    price,
                    currency: currency || 'GBP',
                    image_url: imageUrl || '',
                    source_url: fullUrl,
                    category_slug: categorySlug,
                    scraped_at: new Date(),
                };
            }
            catch (error) {
                this.logger.debug(`Failed to extract product element:`, error.message);
                return null;
            }
        }
        async getProductDetails(page, productUrl) {
            this.logger.log(`Getting product details from: ${productUrl}`);
            try {
                await page.goto(productUrl, { waitUntil: 'networkidle' });
                await this.delay(2000);
                const details = {
                    description: '',
                    specs: {},
                    reviews: [],
                    related_products: [],
                };
                // Extract description
                try {
                    const descriptionEl = await page.$(this.SELECTORS.PRODUCT_DETAIL);
                    if (descriptionEl) {
                        const description = await descriptionEl.textContent();
                        details.description = description?.trim() || '';
                    }
                }
                catch (error) {
                    // Ignore
                }
                // Extract specs from table
                try {
                    const tableEl = await page.$(this.SELECTORS.SPECS_TABLE);
                    if (tableEl) {
                        const rows = await tableEl.$$('tr');
                        for (const row of rows) {
                            const cells = await row.$$('td');
                            if (cells.length >= 2) {
                                const key = await cells[0].textContent();
                                const value = await cells[1].textContent();
                                if (key && value) {
                                    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                                    details.specs[cleanKey] = value.trim();
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    // Ignore
                }
                return details;
            }
            catch (error) {
                this.logger.error(`Failed to get product details:`, error);
                throw error;
            }
        }
        async handleCookieConsent(page) {
            try {
                const cookieConsent = await page.$(this.SELECTORS.COOKIE_CONSENT);
                if (cookieConsent) {
                    this.logger.log('Accepting cookie consent...');
                    const acceptButton = await page.$(this.SELECTORS.COOKIE_ACCEPT);
                    if (acceptButton) {
                        await acceptButton.click();
                        await this.delay(2000);
                    }
                }
            }
            catch (error) {
                this.logger.warn('Cookie consent handling failed:', error.message);
            }
        }
        /**
         * Abstract method implementation from BaseScraper
         * Delegates to the interactive scraping workflow
         */
        async scrape(url, data) {
            const { categorySlug, maxProducts = 100, navigationSlug } = data || {};
            if (!categorySlug) {
                throw new Error('categorySlug is required for interactive scraping');
            }
            this.logger.log(`Starting interactive scrape for category: ${categorySlug}`);
            try {
                const { browser, context, page } = await this.initializeBrowser();
                // Navigate to homepage first if navigation provided
                if (navigationSlug) {
                    await this.navigateToHomepage(page);
                    await this.hoverNavigation(page, navigationSlug);
                }
                // Navigate to category
                const categoryUrl = `https://www.worldofbooks.com/collections/${categorySlug}`;
                await page.goto(categoryUrl, { waitUntil: 'networkidle', timeout: 30000 });
                await this.delay(2000);
                // Scrape products
                let allProducts = [];
                let canLoadMore = true;
                let attempts = 0;
                const maxAttempts = 5;
                while (canLoadMore && allProducts.length < maxProducts && attempts < maxAttempts) {
                    const pageProducts = await this.scrapeProductsFromPage(page, categorySlug, maxProducts - allProducts.length);
                    allProducts = [...allProducts, ...pageProducts];
                    // Try to load more
                    canLoadMore = await this.clickLoadMore(page);
                    attempts++;
                }
                await browser.close();
                return {
                    products: allProducts.slice(0, maxProducts),
                    status: allProducts.length > 0 ? 'success' : 'partial',
                    message: `Scraped ${allProducts.length} products`,
                    totalScraped: allProducts.length,
                    hasMore: canLoadMore,
                };
            }
            catch (error) {
                this.logger.error(`Interactive scrape failed for ${categorySlug}:`, error);
                return {
                    products: [],
                    status: 'failed',
                    message: error.message,
                    totalScraped: 0,
                    hasMore: false,
                };
            }
        }
        extractSourceId(url) {
            // Extract ISBN from URL
            const isbnMatch = url.match(/\b\d{10,13}\b/);
            if (isbnMatch) {
                return `WOB-ISBN-${isbnMatch[0]}`;
            }
            // Extract from path
            try {
                const urlObj = new URL(url.startsWith('http') ? url : `https://www.worldofbooks.com${url}`);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                const productSlug = pathParts[pathParts.length - 1];
                if (productSlug && productSlug.length > 3) {
                    return `WOB-${productSlug}`;
                }
            }
            catch (error) {
                // Ignore URL parsing errors
            }
            // Fallback: hash
            return `WOB-${Buffer.from(url).toString('base64').substring(0, 15)}`;
        }
    };
    __setFunctionName(_classThis, "InteractiveScraper");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InteractiveScraper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InteractiveScraper = _classThis;
})();
exports.InteractiveScraper = InteractiveScraper;
