// test-all-scrapers-actual.js
const { NavigationScraper } = require('../dist/modules/scraper/scrapers/navigation.scraper');
const { CategoryScraper } = require('../dist/modules/scraper/scrapers/category.scraper');
const { ProductDetailScraper } = require('../dist/modules/scraper/scrapers/product-detail.scraper');

async function testAllScrapersActual() {
  console.log('🧪 ACTUAL Testing of All Scrapers (This will take time)\n');
  
  const results = {
    navigation: null,
    category: null,
    productDetail: null
  };
  
  try {
    // 1. Test Navigation Scraper (We know this works)
    console.log('='.repeat(60));
    console.log('1. TESTING NAVIGATION SCRAPER');
    console.log('='.repeat(60));
    
    const navScraper = new NavigationScraper();
    results.navigation = await navScraper.scrape('https://www.worldofbooks.com/');
    
    console.log(`✅ Navigation Scraper SUCCESS`);
    console.log(`   Found ${results.navigation.navigation.length} navigation items`);
    console.log(`   Found ${results.navigation.categories.length} categories`);
    
    if (results.navigation.categories.length === 0) {
      console.log('⚠️  WARNING: No categories found! Category scraper cannot be tested.');
      return results;
    }
    
    // 2. Test Category Scraper with a REAL category
    console.log('\n' + '='.repeat(60));
    console.log('2. TESTING CATEGORY SCRAPER');
    console.log('='.repeat(60));
    
    // Find a category that's NOT "By Category" (which is just # anchor)
    const realCategory = results.navigation.categories.find(cat => 
      cat.url && cat.url.includes('/collections/') && cat.url !== 'https://www.worldofbooks.com/en-gb#'
    );
    
    if (!realCategory) {
      console.log('❌ No real category found for testing');
      console.log('Sample categories:');
      results.navigation.categories.slice(0, 5).forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.title} -> ${cat.url}`);
      });
    } else {
      console.log(`Testing with category: ${realCategory.title}`);
      console.log(`URL: ${realCategory.url}`);
      console.log(`Slug: ${realCategory.slug}`);
      
      const catScraper = new CategoryScraper();
      
      // Set timeout to avoid hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Category scraper timeout after 30 seconds')), 30000);
      });
      
      try {
        const scrapePromise = catScraper.scrape(realCategory.url, realCategory.slug);
        results.category = await Promise.race([scrapePromise, timeoutPromise]);
        
        console.log(`✅ Category Scraper SUCCESS`);
        console.log(`   Found ${results.category.length} products`);
        
        if (results.category.length > 0) {
          console.log('\nSample products:');
          results.category.slice(0, 3).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.title}`);
            console.log(`      Author: ${product.author}`);
            console.log(`      Price: ${product.currency}${product.price}`);
            console.log(`      URL: ${product.source_url}`);
          });
        }
      } catch (error) {
        console.log(`❌ Category Scraper FAILED: ${error.message}`);
        console.log('This could be due to:');
        console.log('   - Selectors not matching the actual page');
        console.log('   - Page structure different than expected');
        console.log('   - Timeout or network issue');
      }
    }
    
    // 3. Test Product Detail Scraper if we have products
    console.log('\n' + '='.repeat(60));
    console.log('3. TESTING PRODUCT DETAIL SCRAPER');
    console.log('='.repeat(60));
    
    if (results.category && results.category.length > 0) {
      const firstProduct = results.category[0];
      console.log(`Testing with product: ${firstProduct.title}`);
      console.log(`URL: ${firstProduct.source_url}`);
      console.log(`Source ID: ${firstProduct.source_id}`);
      
      const detailScraper = new ProductDetailScraper();
      
      const detailTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Product detail scraper timeout after 30 seconds')), 30000);
      });
      
      try {
        const detailPromise = detailScraper.scrape(firstProduct.source_url, firstProduct.source_id);
        results.productDetail = await Promise.race([detailPromise, detailTimeoutPromise]);
        
        console.log(`✅ Product Detail Scraper SUCCESS`);
        console.log(`   Description length: ${results.productDetail.description?.length || 0} chars`);
        console.log(`   Reviews found: ${results.productDetail.reviews.length}`);
        console.log(`   Related products: ${results.productDetail.related_products.length}`);
        
        if (results.productDetail.specs) {
          console.log('\nProduct specs:');
          Object.entries(results.productDetail.specs).forEach(([key, value]) => {
            if (value) console.log(`   ${key}: ${value}`);
          });
        }
      } catch (error) {
        console.log(`❌ Product Detail Scraper FAILED: ${error.message}`);
      }
    } else {
      console.log('⚠️  Skipping product detail test - no products available');
    }
    
  } catch (error) {
    console.error('❌ Overall test failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Navigation Scraper: ${results.navigation ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Category Scraper: ${results.category ? '✅ WORKING' : '❌ FAILED/UNTESTED'}`);
  console.log(`Product Detail Scraper: ${results.productDetail ? '✅ WORKING' : '❌ FAILED/UNTESTED'}`);
  
  return results;
}

// Run with progress indicator
console.log('🚀 Starting actual scraper tests...');
console.log('⏰ This will take 1-2 minutes...\n');

testAllScrapersActual().then(results => {
  console.log('\n🎉 Testing complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});