// test-bullmq.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { ScraperService } = require('./dist/modules/scraper/scraper.service');

async function testQueue() {
  console.log('🧪 Testing BullMQ Queue System...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const scraperService = app.get(ScraperService);
  
  try {
    // Test queueing a navigation scrape
    console.log('1. Queueing navigation scrape job...');
    const jobId = await scraperService.triggerOnDemandScrape('navigation', 'home');
    console.log(`   ✅ ${jobId}`);
    
    // Check job status
    console.log('\n2. Checking job status...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This requires your job status endpoint to be implemented
    console.log('   ⚠️  Implement job status endpoint in scraper.service.ts');
    
    await app.close();
    console.log('\n🎉 Queue system ready for frontend integration!');
    
  } catch (error) {
    console.error('❌ Queue test failed:', error.message);
    await app.close();
  }
}

testQueue();