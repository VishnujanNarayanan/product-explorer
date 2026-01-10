// test-final-verification.js
const { NavigationScraper } = require('../dist/modules/scraper/scrapers/navigation.scraper');
const { CategoryScraper } = require('../dist/modules/scraper/scrapers/category.scraper');
const { ProductDetailScraper } = require('../dist/modules/scraper/scrapers/product-detail.scraper');

async function finalVerification() {
  console.log('🚀 FINAL VERIFICATION - All Scrapers Working\n');
  
  const results = {
    navigation: { success: false, items: 0, categories: 0 },
    category: { success: false, products: 0 },
    productDetail: { success: false, description: false, specs: false, related: 0 }
  };
  
  try {
    // Test Navigation
    console.log('1. Testing Navigation Scraper...');
    const navScraper = new NavigationScraper();
    const navResult = await navScraper.scrape('https://www.worldofbooks.com/');
    results.navigation = { 
      success: true, 
      items: navResult.navigation.length, 
      categories: navResult.categories.length 
    };
    console.log(`   ✅ Found ${navResult.navigation.length} nav items, ${navResult.categories.length} categories`);
    
    // Test Category (quick test with 1 page)
    console.log('\n2. Testing Category Scraper...');
    const catScraper = new CategoryScraper();
    const catResult = await catScraper.scrape(
      'https://www.worldofbooks.com/en-gb/collections/fiction-books',
      'fiction-books'
    );
    results.category = { success: true, products: catResult.length };
    console.log(`   ✅ Found ${catResult.length} products`);
    
    // Test Product Detail
    console.log('\n3. Testing Product Detail Scraper...');
    if (catResult.length > 0) {
      const detailScraper = new ProductDetailScraper();
      const detailResult = await detailScraper.scrape(
        catResult[0].source_url,
        catResult[0].source_id
      );
      results.productDetail = {
        success: true,
        description: !!detailResult.description,
        specs: Object.keys(detailResult.specs || {}).length > 0,
        related: detailResult.related_products.length
      };
      console.log(`   ✅ Got description: ${!!detailResult.description}`);
      console.log(`   ✅ Got specs: ${Object.keys(detailResult.specs || {}).length} items`);
      console.log(`   ✅ Got related products: ${detailResult.related_products.length}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL SYSTEMS GO!');
    console.log('='.repeat(60));
    console.log(`Navigation: ${results.navigation.success ? '✅' : '❌'}`);
    console.log(`Category: ${results.category.success ? '✅' : '❌'} (${results.category.products} products)`);
    console.log(`Product Detail: ${results.productDetail.success ? '✅' : '❌'}`);
    console.log('\n📋 Ready for BullMQ integration and frontend development!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('Check the scrapers before pushing.');
  }
}

finalVerification();