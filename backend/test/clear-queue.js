const { Queue } = require('bullmq');
const redis = require('redis');

async function clearQueue() {
  console.log('Clearing failed queue jobs...');
  
  const queue = new Queue('scraping', {
    connection: { host: 'localhost', port: 6379 }
  });

  try {
    // Get all failed jobs
    const failedJobs = await queue.getJobs(['failed']);
    console.log(`Found ${failedJobs.length} failed jobs`);
    
    // Remove them
    for (const job of failedJobs) {
      await queue.remove(job.id);
      console.log(`Removed failed job: ${job.name}`);
    }

    // Get all waiting jobs  
    const waitingJobs = await queue.getJobs(['waiting']);
    console.log(`Found ${waitingJobs.length} waiting jobs`);
    
    // Remove them too
    for (const job of waitingJobs) {
      await queue.remove(job.id);
      console.log(`Removed waiting job: ${job.name}`);
    }

    console.log('✅ Queue cleared successfully!');
    
  } catch (error) {
    console.error('Error clearing queue:', error.message);
  } finally {
    await queue.close();
  }
  
  // Also clear Redis cache
  console.log('\nClearing Redis cache...');
  const client = redis.createClient({ url: 'redis://localhost:6379' });
  
  await client.connect();
  await client.flushAll();
  console.log('✅ Redis cache cleared!');
  
  await client.quit();
  
  console.log('\n⚠️  Please restart your backend:');
  console.log('   npm run start:dev');
}

clearQueue().catch(console.error);