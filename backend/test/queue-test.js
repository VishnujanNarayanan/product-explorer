// Save as backend/test/queue-test.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testQueue() {
  console.log('=== QUEUE DIAGNOSTIC ===\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get all providers
    const scraperService = app.get('ScraperService');
    console.log('1. ✅ ScraperService found');
    
    // Trigger a scrape
    console.log('\n2. Triggering product scrape...');
    const result = await scraperService.triggerOnDemandScrape('product', 'WOB-001');
    console.log('   Result:', result);
    
    // Check scrape_job table
    const scrapeJobRepo = app.get('ScrapeJobRepository');
    const jobs = await scrapeJobRepo.find({ 
      order: { id: 'DESC' }, 
      take: 1 
    });
    
    console.log('\n3. Latest job:', {
      id: jobs[0]?.id,
      type: jobs[0]?.target_type,
      status: jobs[0]?.status,
    });
    
    // Try to get queue directly
    try {
      const queue = app.get('BullQueue_scraping');
      console.log('\n4. ✅ Queue instance found');
      
      const counts = await queue.getJobCounts();
      console.log('   Queue counts:', counts);
    } catch (err) {
      console.log('\n4. ❌ Queue NOT found:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  await app.close();
  console.log('\n=== END ===');
}

testQueue().catch(console.error);