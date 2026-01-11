const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

async function checkQueue() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the queue
    const queue = app.get('BullQueue_scraping');
    
    // Check job counts
    const counts = await queue.getJobCounts();
    console.log('Queue Status:');
    console.log(`- Waiting: ${counts.waiting}`);
    console.log(`- Active: ${counts.active}`);
    console.log(`- Completed: ${counts.completed}`);
    console.log(`- Failed: ${counts.failed}`);
    
    // List waiting jobs
    const waitingJobs = await queue.getJobs(['waiting']);
    console.log(`\nWaiting Jobs (${waitingJobs.length}):`);
    waitingJobs.forEach((job, i) => {
      console.log(`${i+1}. ${job.name}: ${JSON.stringify(job.data)}`);
    });
    // Add this to check-queue.js
    const failedJobs = await queue.getJobs(['failed'], 0, 10);
    console.log(`\nFailed Jobs (${failedJobs.length}):`);
    failedJobs.forEach((job, i) => {
    console.log(`${i+1}. ${job.name}: ${JSON.stringify(job.data)}`);
    console.log(`   Error: ${job.failedReason}`);
    console.log(`   Stack: ${job.stacktrace}`);
    });
    // List completed jobs
    const completedJobs = await queue.getJobs(['completed'], 0, 5);
    console.log(`\nRecent Completed Jobs (${completedJobs.length}):`);
    completedJobs.forEach((job, i) => {
      console.log(`${i+1}. ${job.name}: ${JSON.stringify(job.data)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

checkQueue();