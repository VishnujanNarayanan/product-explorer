// backend/test/api-test.js
const http = require('http');

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function apiTest() {
  console.log('🔗 Testing Backend API\n');
  
  console.log('1. Testing health endpoint...');
  try {
    const health = await makeRequest('GET', '/health');
    console.log(`   ✅ Health: ${health.data.status} (Status: ${health.status})`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    console.log('   Is backend running on port 3000?');
    return;
  }
  
  console.log('\n2. Getting navigation...');
  try {
    const navigation = await makeRequest('GET', '/navigation');
    console.log(`   ✅ Found ${navigation.data.length} navigation items`);
    
    if (navigation.data.length > 0) {
      console.log('   First item:', navigation.data[0].title);
    }
  } catch (error) {
    console.log(`   ❌ Navigation error: ${error.message}`);
  }
  
  console.log('\n3. Triggering category scrape...');
  try {
    // Get categories first
    const categories = await makeRequest('GET', '/categories');
    if (categories.data && categories.data.length > 0) {
      const firstCategory = categories.data[0];
      console.log(`   Using category: ${firstCategory.title} (${firstCategory.slug})`);
      
      // Trigger scrape
      console.log(`   POST /api/scrape/category/${firstCategory.slug}`);
      const scrapeRes = await makeRequest('POST', `/scrape/category/${firstCategory.slug}`);
      console.log(`   ✅ Response: ${scrapeRes.data}`);
      
      console.log('\n4. Waiting 10 seconds for scraping to start...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('\n5. Check backend logs for:');
      console.log('   [ScrapeProcessor] Processing category scrape: [category]');
      console.log('   [CategoryScraper] Scraping category: [category]');
      
    } else {
      console.log('   No categories found');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n6. Quick database check (via docker)...');
  console.log('   Run this after test completes:');
  console.log(`
   docker exec -it product-explorer-postgres-1 psql -U admin -d wob_explorer -c "
   SELECT COUNT(*) as total_products FROM product;
   SELECT 
     COUNT(*) as real_products 
   FROM product 
   WHERE source_url LIKE '%worldofbooks.com/en-gb%';"
  `);
  
  console.log('\n✅ API test complete');
  console.log('\n📋 NEXT: Check your backend terminal for scraper logs!');
}

apiTest().catch(console.error);