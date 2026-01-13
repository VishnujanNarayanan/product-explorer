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
exports.NavigationScraper = void 0;
const common_1 = require("@nestjs/common");
const crawlee_1 = require("crawlee");
const base_scraper_1 = require("./base.scraper");
let NavigationScraper = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = base_scraper_1.BaseScraper;
    var NavigationScraper = _classThis = class extends _classSuper {
        async scrape(url) {
            const navigation = [];
            const categories = [];
            const crawler = new crawlee_1.PlaywrightCrawler({
                maxRequestsPerCrawl: 1,
                maxConcurrency: 1,
                requestHandler: async ({ page, request }) => {
                    this.logger.log(`Scraping navigation from: ${request.url}`);
                    // 1. Handle cookie consent
                    await this.handleCookieConsent(page);
                    await page.waitForLoadState('networkidle');
                    await this.delay(2000);
                    // 2. GET THE 8 MAIN NAVIGATION ITEMS (always the same)
                    const mainNavItems = [
                        { title: 'Clearance', slug: 'clearance', hasChildren: false },
                        { title: 'eGift Cards', slug: 'egift-cards', hasChildren: false },
                        { title: 'Fiction Books', slug: 'fiction-books', hasChildren: true },
                        { title: 'Non-Fiction Books', slug: 'non-fiction-books', hasChildren: true },
                        { title: 'Children\'s Books', slug: 'childrens-books', hasChildren: true },
                        { title: 'Rare Books', slug: 'rare-books', hasChildren: true },
                        { title: 'Music & Film', slug: 'music-film', hasChildren: true },
                        { title: 'Sell Your Books', slug: 'sell-your-books', hasChildren: false }
                    ];
                    for (const item of mainNavItems) {
                        navigation.push({
                            ...item,
                            url: this.getUrlForNavItem(item.title, item.slug)
                        });
                    }
                    this.logger.log(`Added ${navigation.length} main navigation items`);
                    // 3. EXTRACT CATEGORIES USING data-menu_category ATTRIBUTES
                    // This is the KEY FIX - using the data attributes you found!
                    const categoryData = await page.$$eval('a[data-menu_category]', (links) => links.map(link => ({
                        navTitle: link.getAttribute('data-menu_category'),
                        categoryTitle: link.getAttribute('data-menu_subcategory'),
                        href: link.href,
                        text: link.textContent?.trim()
                    })));
                    this.logger.log(`Found ${categoryData.length} category links with data attributes`);
                    // 4. PROCESS AND ORGANIZE CATEGORIES
                    const processedSlugs = new Set();
                    for (const data of categoryData) {
                        if (!data.navTitle || !data.categoryTitle || !data.href)
                            continue;
                        // Find matching navigation item
                        const matchingNav = navigation.find(nav => data.navTitle.includes(nav.title) ||
                            nav.title.includes(data.navTitle));
                        if (!matchingNav) {
                            this.logger.debug(`No matching nav for: "${data.navTitle}"`);
                            continue;
                        }
                        // Extract slug from URL
                        const slug = this.extractSlugFromUrl(data.href);
                        // Skip duplicates
                        if (processedSlugs.has(slug))
                            continue;
                        // Add category
                        categories.push({
                            title: data.categoryTitle,
                            slug,
                            url: data.href,
                            parentSlug: matchingNav.slug,
                            level: 1
                        });
                        processedSlugs.add(slug);
                        this.logger.debug(`Added: "${data.categoryTitle}" → ${matchingNav.title}`);
                    }
                    // 5. LOG RESULTS
                    const categoriesByNav = {};
                    categories.forEach(cat => {
                        if (cat.parentSlug) {
                            const navTitle = navigation.find(n => n.slug === cat.parentSlug)?.title || 'unknown';
                            categoriesByNav[navTitle] = (categoriesByNav[navTitle] || 0) + 1;
                        }
                    });
                    this.logger.log(`Extracted ${categories.length} total categories`);
                    Object.entries(categoriesByNav).forEach(([nav, count]) => {
                        this.logger.log(`  ${nav}: ${count} categories`);
                    });
                },
            });
            try {
                await crawler.run([{
                        url: url,
                        uniqueKey: 'nav-data-attributes-v1',
                        label: 'navigation',
                    }]);
                return { navigation, categories };
            }
            catch (error) {
                this.logger.error(`Scraper failed: ${error.message}`);
                return { navigation: [], categories: [] };
            }
        }
        getUrlForNavItem(title, slug) {
            const baseUrl = 'https://www.worldofbooks.com/en-gb';
            const urlMap = {
                'Clearance': `${baseUrl}/pages/clearance`,
                'eGift Cards': `${baseUrl}/pages/Gift-cards`,
                'Fiction Books': `${baseUrl}/pages/fiction`,
                'Non-Fiction Books': `${baseUrl}/pages/non-fiction`,
                'Children\'s Books': `${baseUrl}/pages/childrens`,
                'Rare Books': `${baseUrl}/collections/rarebooks`,
                'Music & Film': `${baseUrl}/pages/music-film`,
                'Sell Your Books': 'https://ziffit.onelink.me/mXLK/wobuk'
            };
            return urlMap[title] || `${baseUrl}/pages/${slug}`;
        }
        async handleCookieConsent(page) {
            try {
                const cookieConsent = await page.$('#onetrust-consent-sdk, .onetrust-pc-dark-filter');
                if (cookieConsent) {
                    this.logger.log('Accepting cookie consent...');
                    const acceptButton = await page.$('#onetrust-accept-btn-handler, button[aria-label="Accept"]');
                    if (acceptButton) {
                        await acceptButton.click();
                        await this.delay(2000);
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Cookie consent failed: ${error.message}`);
            }
        }
    };
    __setFunctionName(_classThis, "NavigationScraper");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NavigationScraper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return NavigationScraper = _classThis;
})();
exports.NavigationScraper = NavigationScraper;
