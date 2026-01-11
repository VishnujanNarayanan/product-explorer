// backend/test/bullmq-test.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { Queue } = require('bull');

async function testBullMQ() {
  console.log('🧪 Testing BullMQ Queue System\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('1. Testing Redis connection...');
  try {
    const queue = app.get('BullQueue_scraping');
    console.log('✅ Queue instance found');
    
    // Check Redis connection
    const client = await queue.client;
    const ping = await client.ping();
    console.log(`✅ Redis ping: ${ping}`);
    
    console.log('\n2. Checking queue status...');
    const counts = await queue.getJobCounts();
    console.log(`   Queue counts:`, JSON.stringify(counts, null, 2));
    
    console.log('\n3. Testing job creation...');
    const testJob = await queue.add('test-job', {
      test: true,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`✅ Test job created: ${testJob.id}`);
    
    console.log('\n4. Checking if workers are processing...');
    console.log('   Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const jobStatus = await testJob.getState();
    console.log(`   Job state: ${jobStatus}`);
    
    if (jobStatus === 'completed') {
      console.log('✅ BullMQ workers are PROCESSING jobs!');
    } else if (jobStatus === 'failed') {
      console.log('⚠️ Job failed - check processor');
      const job = await queue.getJob(testJob.id);
      console.log('   Error:', job.failedReason);
    } else {
      console.log(`❌ Job not processed (state: ${jobStatus})`);
      console.log('   BullMQ workers are NOT processing jobs');
    }
    
    // Clean up
    await testJob.remove();
    
  } catch (error) {
    console.error(`❌ BullMQ test failed: ${error.message}`);
    console.error('Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
  }
  
  console.log('\n5. Testing ScraperService queue methods...');
  try {
    const scraperService = app.get('ScraperService');
    
    // Test trigger method
    const message = await scraperService.triggerOnDemandScrape('navigation', 'https://www.worldofbooks.com/');
    console.log(`✅ Trigger method: ${message}`);
    
    // Check job was created
    const scrapeJobRepo = app.get('ScrapeJobRepository');
    const jobs = await scrapeJobRepo.find({ order: { id: 'DESC' }, take: 1 });
    console.log(`   Latest scrape job: ${jobs[0]?.id} - ${jobs[0]?.status}`);
    
  } catch (error) {
    console.error(`❌ ScraperService test failed: ${error.message}`);
  }
  
  await app.close();
  console.log('\n🔚 Test complete');
}

testBullMQ().catch(console.error);