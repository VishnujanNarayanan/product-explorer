// backend/test/test-product-detail-save.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testProductDetail() {
  console.log('🧪 Testing Product Detail Scraping\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('1. Getting a product from database...');
  const productRepo = app.get('ProductRepository');
  const products = await productRepo.find({ take: 1 });
  
  if (products.length === 0) {
    console.log('❌ No products in database to test');
    await app.close();
    return;
  }
  
  const product = products[0];
  console.log(`✅ Found product: ${product.title} (${product.source_id})`);
  console.log(`   URL: ${product.source_url}`);
  
  console.log('\n2. Triggering product detail scrape...');
  const scraperService = app.get('ScraperService');
  
  // Force refresh
  console.log('   Sending to queue...');
  const message = await scraperService.triggerOnDemandScrape('product', product.source_id);
  console.log(`   ${message}`);
  
  console.log('\n3. Waiting 30 seconds for async processing...');
  console.log('   (Product detail scraping takes time)');
  
  for (let i = 1; i <= 30; i++) {
    process.stdout.write(`   ${i}s... `);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (i % 10 === 0) {
      // Check job status
      const scrapeJobRepo = app.get('ScrapeJobRepository');
      const latestJob = await scrapeJobRepo.findOne({ 
        where: { target_type: 'product' },
        order: { id: 'DESC' }
      });
      
      if (latestJob) {
        console.log(`\n   Job status: ${latestJob.status}`);
        if (latestJob.status === 'completed') break;
      }
    }
  }
  
  console.log('\n\n4. Checking results...');
  const detailRepo = app.get('ProductDetailRepository');
  const detail = await detailRepo.findOne({ where: { product_id: product.id } });
  
  if (detail) {
    console.log('✅ SUCCESS! Product detail saved to database!');
    console.log(`   Description length: ${detail.description?.length || 0} chars`);
    console.log(`   Reviews count in detail: ${detail.reviews_count}`);
  } else {
    console.log('❌ Product detail NOT saved');
  }
  
  // Check reviews
  const reviewRepo = app.get('ReviewRepository');
  const reviews = await reviewRepo.find({ where: { product_id: product.id } });
  console.log(`   Reviews in database: ${reviews.length}`);
  
  await app.close();
  console.log('\n🎯 Test complete');
}

testProductDetail().catch(console.error);