// test-category.js
const { CategoryScraper } = require('../dist/modules/scraper/scrapers/category.scraper');

async function testCategoryScraperFinal() {
  console.log('🧪 Testing Category Scraper with Cookie Fix...\n');
  
  try {
    const scraper = new CategoryScraper();
    
    const testUrl = 'https://www.worldofbooks.com/en-gb/collections/fiction-books';
    const categorySlug = 'fiction-books'
    
    console.log(`Testing with: ${testUrl}`);
    console.log(`Category slug: ${categorySlug}`);
    console.log('\n⏰ This will take about 20 seconds...\n');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout after 90 seconds')), 90000);
    });
    
    const scrapePromise = scraper.scrape(testUrl, categorySlug);
    const products = await Promise.race([scrapePromise, timeoutPromise]);
    
    console.log(`\n✅ SUCCESS! Found ${products.length} products\n`);
    
    if (products.length > 0) {
      console.log('📦 Sample products (first 5):');
      products.slice(0, 5).forEach((product, i) => {
        console.log(`\n${i + 1}. ${product.title}`);
        console.log(`   Author: ${product.author}`);
        console.log(`   Price: ${product.currency}${product.price.toFixed(2)}`);
        console.log(`   ID: ${product.source_id}`);
        console.log(`   URL: ${product.source_url.substring(0, 60)}...`);
      });
      
      console.log(`\n📊 Statistics:`);
      console.log(`   Total products: ${products.length}`);
      console.log(`   Unique prices: ${new Set(products.map(p => p.currency + p.price.toFixed(2))).size}`);
      console.log(`   Authors: ${new Set(products.map(p => p.author)).size} unique`);
      
      // Check if we got more than initial 40
      if (products.length > 40) {
        console.log(`   ✅ Pagination working! Got ${products.length} products (> 40 initial)`);
      } else {
        console.log(`   ⚠️  Only got initial 40 products (pagination may have issues)`);
      }
    }
    
    return products;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace (first 3 lines):');
      console.error(error.stack.split('\n').slice(0, 3).join('\n'));
    }
    throw error;
  }
}

console.log('🚀 Starting category scraper test with cookie fix...');
testCategoryScraperFinal().then(products => {
  console.log('\n🎉 Category scraper test complete!');
  console.log(`📋 Next: Test with ${products.length} products for Product Detail Scraper`);
}).catch(() => {
  console.log('\n❌ Need further debugging');
  process.exit(1);
});