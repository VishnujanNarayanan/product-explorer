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
exports.CategoryScraper = void 0;
const common_1 = require("@nestjs/common");
const crawlee_1 = require("crawlee");
const base_scraper_1 = require("./base.scraper");
let CategoryScraper = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = base_scraper_1.BaseScraper;
    var CategoryScraper = _classThis = class extends _classSuper {
        constructor() {
            super(...arguments);
            this.SELECTORS = {
                // CORRECT selectors for World of Books
                PRODUCT_GRID: '.plp-listing',
                PRODUCT_CARD: '.main-product-card',
                PRODUCT_TITLE: '.card__heading a',
                PRODUCT_AUTHOR: '.truncate-author',
                PRODUCT_PRICE: '.price-item',
                PRODUCT_IMAGE: '.card__media img',
                LOAD_MORE: '#custom-load-more',
                // Navigation selectors
                NAV_ITEM: 'nav a[href*="/pages/"], nav a[href*="/collections/"]',
                CATEGORY_LINK: 'a[data-menu_subcategory]',
                COOKIE_CONSENT: '#onetrust-consent-sdk, .onetrust-pc-dark-filter',
                COOKIE_ACCEPT: '#onetrust-accept-btn-handler, button[aria-label="Accept"]',
            };
        }
        async scrape(url, categorySlug, maxProducts = 100, navigationSlug) {
            const products = [];
            const BASE_URL = 'https://www.worldofbooks.com';
            const startUrl = navigationSlug ? BASE_URL : url; // Start at homepage if navigating through site
            const crawler = new crawlee_1.PlaywrightCrawler({
                maxRequestsPerCrawl: 50,
                maxConcurrency: 1,
                requestHandler: async ({ page, request }) => {
                    this.logger.log(`Scraping category: ${categorySlug} with navigation: ${navigationSlug || 'direct'}`);
                    // If navigationSlug is provided, start at homepage and navigate through the site properly
                    if (navigationSlug && request.url === BASE_URL) {
                        this.logger.log(`Starting at homepage, navigating through navigation: ${navigationSlug}`);
                        // Handle cookie consent
                        await this.handleCookieConsent(page);
                        await page.waitForLoadState('networkidle');
                        await this.delay(2000);
                        // Step 1: Find and hover/click the navigation item
                        const navClicked = await this.clickNavigationItem(page, navigationSlug);
                        if (!navClicked) {
                            this.logger.warn(`Failed to click navigation item: ${navigationSlug}, proceeding with direct URL`);
                            // Fallback: navigate directly to category URL
                            await page.goto(`${BASE_URL}/collections/${categorySlug}`, { waitUntil: 'networkidle' });
                            await this.delay(2000);
                        }
                        else {
                            await this.delay(2000); // Wait for menu to appear
                            // Step 2: Find and click the category link
                            const categoryClicked = await this.clickCategoryLink(page, categorySlug);
                            if (!categoryClicked) {
                                this.logger.warn(`Failed to click category link: ${categorySlug}, proceeding with direct URL`);
                                // Fallback: navigate directly to category URL
                                await page.goto(`${BASE_URL}/collections/${categorySlug}`, { waitUntil: 'networkidle' });
                                await this.delay(2000);
                            }
                            else {
                                // Wait for category page to load
                                await page.waitForLoadState('networkidle');
                                await this.delay(2000);
                            }
                        }
                    }
                    else {
                        // Direct navigation (fallback or no navigation context)
                        this.logger.log(`Navigating directly to category URL: ${url}`);
                        await this.handleCookieConsent(page);
                        await page.waitForLoadState('networkidle');
                        await this.delay(2000);
                    }
                    // Wait for product grid
                    await page.waitForSelector(this.SELECTORS.PRODUCT_GRID, { timeout: 15000 });
                    await this.delay(2000);
                    let totalProducts = 0;
                    const MAX_LOAD_MORE_CLICKS = 5; // Limit clicks for demo
                    // Click "Load More" multiple times
                    for (let clickCount = 0; clickCount < MAX_LOAD_MORE_CLICKS; clickCount++) {
                        try {
                            this.logger.log(`Extracting page ${clickCount + 1} for ${categorySlug}`);
                            // Extract current products
                            const pageProducts = await this.extractPageProducts(page, categorySlug);
                            // Add new products
                            for (const product of pageProducts) {
                                if (!products.some(p => p.source_id === product.source_id)) {
                                    products.push(product);
                                    totalProducts++;
                                    if (totalProducts >= maxProducts) {
                                        this.logger.log(`Reached max products (${maxProducts})`);
                                        return;
                                    }
                                }
                            }
                            // Try to click "Load More"
                            const hasMore = await this.clickLoadMore(page);
                            if (!hasMore) {
                                this.logger.log('No more products to load');
                                break;
                            }
                            await this.delay(3000); // Wait for new products to load
                        }
                        catch (error) {
                            this.logger.warn(`Page ${clickCount + 1} failed: ${error.message}`);
                            break;
                        }
                    }
                    this.logger.log(`Scraped ${products.length} products from ${categorySlug}`);
                },
            });
            await crawler.run([{
                    url: startUrl,
                    uniqueKey: `category-${categorySlug}-${Date.now()}`,
                    label: 'category',
                    userData: { categorySlug, maxProducts, navigationSlug }
                }]);
            return products;
        }
        /**
         * Extract products from current page
         */
        async extractPageProducts(page, categorySlug) {
            const products = [];
            const productElements = await page.$$(this.SELECTORS.PRODUCT_CARD);
            this.logger.debug(`Found ${productElements.length} product cards on page`);
            for (const productEl of productElements) {
                try {
                    const product = await this.extractSingleProduct(productEl, categorySlug);
                    if (product)
                        products.push(product);
                }
                catch (error) {
                    // Skip failed products
                }
            }
            return products;
        }
        /**
         * Extract single product
         */
        async extractSingleProduct(productEl, categorySlug) {
            try {
                // Title
                const titleEl = await productEl.$(this.SELECTORS.PRODUCT_TITLE);
                if (!titleEl)
                    return null;
                const title = await titleEl.textContent();
                const productUrl = await titleEl.getAttribute('href');
                if (!title || !productUrl)
                    return null;
                // Author
                const authorEl = await productEl.$(this.SELECTORS.PRODUCT_AUTHOR);
                const author = authorEl ? await authorEl.textContent() : 'Unknown';
                // Price
                const priceEl = await productEl.$(this.SELECTORS.PRODUCT_PRICE);
                const priceText = priceEl ? await priceEl.textContent() : '';
                const { amount: price, currency } = this.normalizePrice(priceText || '');
                // Image
                const imageEl = await productEl.$(this.SELECTORS.PRODUCT_IMAGE);
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
                };
            }
            catch (error) {
                return null;
            }
        }
        /**
         * Click Load More button
         */
        async clickLoadMore(page) {
            try {
                const loadMoreBtn = await page.$(this.SELECTORS.LOAD_MORE);
                if (!loadMoreBtn) {
                    this.logger.debug('Load More button not found');
                    return false;
                }
                // Check if button is visible and enabled
                const isVisible = await loadMoreBtn.evaluate((el) => {
                    return el.offsetParent !== null && !el.disabled;
                });
                if (!isVisible) {
                    this.logger.debug('Load More button not visible or disabled');
                    return false;
                }
                // Scroll to button
                await loadMoreBtn.scrollIntoViewIfNeeded();
                await this.delay(500);
                // Click via JavaScript to avoid blocking
                await page.evaluate((btn) => {
                    btn.click();
                }, loadMoreBtn);
                this.logger.debug('Clicked Load More button');
                return true;
            }
            catch (error) {
                this.logger.debug('Failed to click Load More:', error.message);
                return false;
            }
        }
        /**
         * Extract source ID from product URL
         */
        extractSourceId(url) {
            // Extract ISBN from URL
            const isbnMatch = url.match(/\b\d{10,13}\b/);
            if (isbnMatch)
                return `WOB-ISBN-${isbnMatch[0]}`;
            // Extract from URL path
            const urlObj = new URL(url.startsWith('http') ? url : `https://www.worldofbooks.com${url}`);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            // Get product slug
            const productSlug = pathParts[pathParts.length - 1];
            if (productSlug && productSlug.length > 3) {
                return `WOB-${productSlug}`;
            }
            // Fallback: hash of URL
            return `WOB-${Buffer.from(url).toString('base64').substring(0, 15)}`;
        }
        /**
         * Handle cookie consent
         */
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
                this.logger.warn(`Cookie consent handling failed: ${error.message}`);
            }
        }
        /**
         * Click navigation item to open menu
         */
        async clickNavigationItem(page, navigationSlug) {
            try {
                // Map navigation slugs to their titles/selectors
                const navMap = {
                    'fiction-books': 'Fiction Books',
                    'non-fiction-books': 'Non-Fiction Books',
                    'childrens-books': 'Children\'s Books',
                    'rare-books': 'Rare Books',
                    'music-film': 'Music & Film',
                };
                const navTitle = navMap[navigationSlug];
                if (!navTitle) {
                    this.logger.debug(`No mapping found for navigation slug: ${navigationSlug}`);
                    return false;
                }
                // Try to find navigation link by text content or href
                const navLinks = await page.$$(this.SELECTORS.NAV_ITEM);
                for (const link of navLinks) {
                    const text = await link.textContent();
                    const href = await link.getAttribute('href');
                    if (text && (text.includes(navTitle) || href?.includes(navigationSlug))) {
                        // Hover to open menu
                        await link.hover();
                        await this.delay(1000);
                        this.logger.log(`Hovered over navigation item: ${navTitle}`);
                        return true;
                    }
                }
                // Alternative: try finding by data-menu_category attribute
                const categoryLinks = await page.$$(`a[data-menu_category*="${navTitle}"]`);
                if (categoryLinks.length > 0) {
                    // Hover over first parent nav item
                    const parentNav = await categoryLinks[0].evaluateHandle((el) => {
                        let current = el;
                        while (current && current.parentElement) {
                            current = current.parentElement;
                            if (current.tagName === 'NAV' || current.classList.contains('nav')) {
                                return current;
                            }
                        }
                        return null;
                    });
                    if (parentNav) {
                        await parentNav.hover();
                        await this.delay(1000);
                        return true;
                    }
                }
                this.logger.debug(`Navigation item not found: ${navTitle}`);
                return false;
            }
            catch (error) {
                this.logger.warn(`Failed to click navigation item: ${error.message}`);
                return false;
            }
        }
        /**
         * Click category link in navigation menu
         */
        async clickCategoryLink(page, categorySlug) {
            try {
                // Find category link by data-menu_subcategory attribute or href
                const categoryLinks = await page.$$(this.SELECTORS.CATEGORY_LINK);
                for (const link of categoryLinks) {
                    const href = await link.getAttribute('href');
                    const dataSubcategory = await link.getAttribute('data-menu_subcategory');
                    // Check if this link matches our category slug
                    if (href && (href.includes(categorySlug) || href.endsWith(`/${categorySlug}`))) {
                        this.logger.log(`Found category link: ${href}`);
                        // Scroll into view and click
                        await link.scrollIntoViewIfNeeded();
                        await this.delay(500);
                        // Click the link
                        await link.click();
                        await this.delay(1000);
                        this.logger.log(`Clicked category link: ${categorySlug}`);
                        return true;
                    }
                    // Also check by data attribute
                    if (dataSubcategory && dataSubcategory.toLowerCase().includes(categorySlug.toLowerCase())) {
                        await link.scrollIntoViewIfNeeded();
                        await this.delay(500);
                        await link.click();
                        await this.delay(1000);
                        this.logger.log(`Clicked category link via data attribute: ${categorySlug}`);
                        return true;
                    }
                }
                // Fallback: try finding by URL pattern
                const allLinks = await page.$$(`a[href*="${categorySlug}"]`);
                for (const link of allLinks) {
                    const href = await link.getAttribute('href');
                    if (href && href.includes(`/collections/${categorySlug}`)) {
                        await link.scrollIntoViewIfNeeded();
                        await this.delay(500);
                        await link.click();
                        await this.delay(1000);
                        this.logger.log(`Clicked category link via href match: ${categorySlug}`);
                        return true;
                    }
                }
                this.logger.debug(`Category link not found: ${categorySlug}`);
                return false;
            }
            catch (error) {
                this.logger.warn(`Failed to click category link: ${error.message}`);
                return false;
            }
        }
    };
    __setFunctionName(_classThis, "CategoryScraper");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CategoryScraper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CategoryScraper = _classThis;
})();
exports.CategoryScraper = CategoryScraper;
