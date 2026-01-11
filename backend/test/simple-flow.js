// Simple test without axios dependency
const http = require('http');

function makeRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {}
    };
    
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }
    
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testFlow() {
  console.log('🚀 Testing backend flow...\n');
  
  try {
    // 1. Health check
    console.log('1. Health check...');
    const health = await makeRequest('GET', 'http://localhost:3000/api/health');
    console.log(`   Status: ${health.status}, DB: ${health.data?.services?.database || 'unknown'}`);
    
    // 2. Navigation
    console.log('\n2. Navigation...');
    const nav = await makeRequest('GET', 'http://localhost:3000/api/navigation');
    console.log(`   Status: ${nav.status}, Items: ${Array.isArray(nav.data) ? nav.data.length : 'N/A'}`);
    
    if (nav.status === 200 && Array.isArray(nav.data)) {
      console.log(`   First item: ${nav.data[0]?.title || 'N/A'}`);
    }
    
    // 3. Categories
    console.log('\n3. Categories...');
    const categories = await makeRequest('GET', 'http://localhost:3000/api/categories');
    console.log(`   Status: ${categories.status}, Count: ${Array.isArray(categories.data) ? categories.data.length : 'N/A'}`);
    
    // Find crime-and-mystery
    if (Array.isArray(categories.data)) {
      const crimeCat = categories.data.find(c => 
        c.slug && (c.slug.includes('crime-and-mystery') || c.slug.includes('crime'))
        );
      if (crimeCat) {
        console.log(`   Found crime category: ${crimeCat.title}`);
        
        // 4. Get products
        console.log('\n4. Getting products...');
        const products = await makeRequest('GET', `http://localhost:3000/api/categories/${crimeCat.slug}/products`);
        console.log(`   Status: ${products.status}`);
        
        if (products.status === 200 && products.data?.products) {
          console.log(`   Message: ${products.data.message}`);
          console.log(`   Products found: ${products.data.products.length}`);
          
          if (products.data.products.length > 0) {
            const testProduct = products.data.products[0];
            console.log(`   Sample product: ${testProduct.title} (${testProduct.source_id})`);
            
            // 5. Test product detail API
            console.log('\n5. Testing product detail API...');
            const productDetail = await makeRequest('POST', `http://localhost:3000/api/scrape/product/${testProduct.source_id}`, {
              refresh: false
            });
            
            console.log(`   Status: ${productDetail.status}`);
            if (productDetail.status === 200) {
              console.log(`   ✅ Success! Message: ${productDetail.data?.message}`);
              console.log(`   Has details: ${productDetail.data?.hasDetails || false}`);
            } else {
              console.log(`   ❌ Failed: ${productDetail.data?.message || 'Unknown error'}`);
            }
          }
        }
      }
    }
    
    console.log('\n🎉 Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testFlow();