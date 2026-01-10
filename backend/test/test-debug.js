// test-debug.js - Minimal debug
const { PlaywrightCrawler } = require('crawlee');

async function debug() {
  console.log('Testing Crawlee setup...');
  
  const crawler = new PlaywrightCrawler({
    requestHandler: async ({ page, request }) => {
      console.log(`✅ Page loaded: ${request.url}`);
      console.log(`📄 Title: ${await page.title()}`);
    }
  });

  await crawler.run([{
    url: 'https://www.worldofbooks.com/',
    uniqueKey: 'test'
  }]);
  
  console.log('✅ Basic Crawlee test passed!');
}

debug().catch(console.error);