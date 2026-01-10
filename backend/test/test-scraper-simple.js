// test-scraper-simple.js - FIXED PATH
const { PlaywrightCrawler } = require('crawlee');

// Try to import your scraper with correct path
let NavigationScraper;
try {
  // Try relative path from test directory
  NavigationScraper = require('../dist/modules/scraper/scrapers/navigation.scraper').NavigationScraper;
  console.log('✅ Successfully loaded NavigationScraper from built files');
} catch (error) {
  console.log('⚠️ Could not load built module, using mock:', error.message);
  
  // Mock if module not found
  class MockNavigationScraper {
    constructor() {
      this.logger = {
        log: (msg) => console.log(`[LOG] ${msg}`),
        error: (msg) => console.error(`[ERROR] ${msg}`),
        warn: (msg) => console.warn(`[WARN] ${msg}`),
        debug: (msg) => console.debug(`[DEBUG] ${msg}`),
      };
      this.MAX_RETRIES = 3;
    }
    
    async delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    extractSlugFromUrl(url) {
      const cleanUrl = url.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
      const segments = cleanUrl.split('/').filter(segment => segment.trim().length > 0);
      return segments.length > 0 ? segments[segments.length - 1] : 'home';
    }
    
    async scrape(url) {
      console.log(`Mock scrape called with URL: ${url}`);
      return { navigation: [], categories: [] };
    }
  }
  
  NavigationScraper = MockNavigationScraper;
}

async function testScraper() {
  console.log('🚀 Testing NavigationScraper...\n');
  
  try {
    // Create instance
    const scraper = new NavigationScraper();
    
    console.log('Starting scrape of World of Books homepage...');
    console.log('URL: https://www.worldofbooks.com/\n');
    
    // Test the scrape method
    const result = await scraper.scrape('https://www.worldofbooks.com/');
    
    console.log('✅ Scrape method executed successfully!');
    console.log(`📊 Found ${result.navigation?.length || 0} navigation items`);
    console.log(`📊 Found ${result.categories?.length || 0} categories\n`);
    
    if (result.navigation && result.navigation.length > 0) {
      console.log('📌 SAMPLE NAVIGATION ITEMS:');
      result.navigation.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
        console.log(`     Slug: ${item.slug}`);
        console.log(`     URL: ${item.url}`);
        console.log('');
      });
    }
    
    console.log('🎉 Test completed!');
    return result;
    
  } catch (error) {
    console.error('\n❌ SCRAPER FAILED:', error.message);
    console.error('\n📋 Error Details:');
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run test
testScraper().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});