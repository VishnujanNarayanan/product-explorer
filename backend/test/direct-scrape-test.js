// backend/test/direct-scrape-test.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CategoryScraper } = require('../dist/modules/scraper/scrapers/category.scraper');

async function directScrapeTest() {
  console.log('🎯 Direct Category Scraping Test\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('1. Getting category scraper directly...');
  const categoryScraper = app.get(CategoryScraper);
  console.log('✅ CategoryScraper found');
  
  console.log('\n2. Scraping "fiction-books" category...');
  console.log('   URL: https://www.worldofbooks.com/en-gb/collections/fiction-books');
  
  try {
    const products = await categoryScraper.scrape(
      'https://www.worldofbooks.com/en-gb/collections/fiction-books',
      'fiction-books'
    );
    
    console.log(`\n✅ SUCCESS! Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('\nSample products:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i+1}. ${p.title}`);
        console.log(`      Price: ${p.currency}${p.price}`);
        console.log(`      URL: ${p.source_url}`);
      });
      
      console.log('\n📝 Note: These are scraped but NOT saved to database yet.');
      console.log('   To save them, we need to fix the ScraperService export.');
    }
    
  } catch (error) {
    console.log(`\n❌ Scrape failed: ${error.message}`);
  }
  
  await app.close();
  console.log('\n✅ Test complete');
}

directScrapeTest().catch(console.error);