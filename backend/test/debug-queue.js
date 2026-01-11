const { Queue } = require('bull');
const redis = require('redis');

async function debugQueue() {
  const queue = new Queue('scraping', {
    redis: { host: 'localhost', port: 6379 }
  });

  console.log('=== QUEUE DEBUG ===\n');

  // Get counts
  const counts = await queue.getJobCounts();
  console.log('Job counts:', counts);

  // Get failed jobs
  const failed = await queue.getJobs(['failed'], 0, 10);
  console.log(`\nFailed jobs (${failed.length}):`);
  
  failed.forEach((job, i) => {
    console.log(`\n${i+1}. ${job.name}`);
    console.log(`   Data:`, JSON.stringify(job.data, null, 2));
    console.log(`   Error:`, job.failedReason);
    console.log(`   Stack:`, job.stacktrace);
  });

  // Get waiting jobs  
  const waiting = await queue.getJobs(['waiting'], 0, 10);
  console.log(`\nWaiting jobs (${waiting.length}):`);
  waiting.forEach((job, i) => {
    console.log(`${i+1}. ${job.name}: ${JSON.stringify(job.data)}`);
  });

  // Clear failed jobs if stuck
  if (failed.length > 0) {
    console.log('\n⚠️ Clearing failed jobs...');
    for (const job of failed) {
      await job.remove();
    }
    console.log('✅ Cleared failed jobs');
  }

  await queue.close();
}

debugQueue().catch(console.error);