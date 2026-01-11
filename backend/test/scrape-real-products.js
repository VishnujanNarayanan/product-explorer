// backend/test/scrape-real-products.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

async function scrapeRealProducts() {
  console.log('📚 Scraping REAL Products from World of Books\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('1. Getting a real category from database...');
  const categoryRepo = app.get('CategoryRepository');
  const categories = await categoryRepo.find({ take: 3 });
  
  if (categories.length === 0) {
    console.log('❌ No categories found. Need to scrape navigation first.');
    await app.close();
    return;
  }
  
  console.log('Found categories:');
  categories.forEach((cat, i) => {
    console.log(`   ${i+1}. ${cat.title} (slug: ${cat.slug})`);
  });
  
  // Use the first real-looking category
  const targetCategory = categories.find(c => 
    !c.slug.includes('seed') && c.slug.length > 3
  ) || categories[0];
  
  console.log(`\n2. Scraping category: ${targetCategory.title}`);
  console.log(`   Slug: ${targetCategory.slug}`);
  
  const scraperService = app.get('ScraperService');
  
  console.log('\n3. Triggering category scrape...');
  const result = await scraperService.triggerOnDemandScrape('category', targetCategory.slug);
  console.log(`   Result: ${result}`);
  
  console.log('\n4. Waiting 30 seconds for scraping...');
  console.log('   Check backend logs for scraping progress');
  
  for (let i = 1; i <= 30; i++) {
    process.stdout.write(`   ${i}s... `);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (i % 10 === 0) {
      // Check progress
      const productRepo = app.get('ProductRepository');
      const productCount = await productRepo.count({
        where: { category: { id: targetCategory.id } }
      });
      console.log(`\n   Products so far: ${productCount}`);
    }
  }
  
  console.log('\n\n5. Checking results...');
  const productRepo = app.get('ProductRepository');
  const realProducts = await productRepo.find({
    where: { 
      category: { id: targetCategory.id },
      source_url: 'https://worldofbooks.com/book1'  // Exclude seed data
    },
    take: 5
  });
  
  console.log(`Found ${realProducts.length} REAL products (excluding seed):`);
  realProducts.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.title} (${p.source_id})`);
    console.log(`      URL: ${p.source_url}`);
  });
  
  if (realProducts.length > 0) {
    console.log('\n🎉 Now you can test product detail scraping on REAL URLs!');
  } else {
    console.log('\n⚠️ No real products scraped yet. Check backend logs for errors.');
  }
  
  await app.close();
  console.log('\n✅ Test complete');
}

scrapeRealProducts().catch(console.error);