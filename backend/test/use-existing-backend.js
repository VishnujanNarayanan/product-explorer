// backend/test/use-existing-backend.js
const axios = require('axios');

async function testExistingBackend() {
  console.log('🚀 Testing Existing Backend API\n');
  
  const API_URL = 'http://localhost:3000/api';
  
  console.log('1. Testing health endpoint...');
  try {
    const health = await axios.get(`${API_URL}/health`);
    console.log(`   ✅ Health: ${health.data.status}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    return;
  }
  
  console.log('\n2. Getting current navigation...');
  try {
    const navigation = await axios.get(`${API_URL}/navigation`);
    console.log(`   ✅ Found ${navigation.data.length} navigation items`);
    
    if (navigation.data.length > 0) {
      console.log('   Sample:');
      navigation.data.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i+1}. ${item.title} (${item.slug})`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Navigation error: ${error.message}`);
  }
  
  console.log('\n3. Triggering REAL product scrape via API...');
  try {
    // First, let's find a real category
    const categories = await axios.get(`${API_URL}/categories`);
    if (categories.data.length > 0) {
      const firstCategory = categories.data[0];
      console.log(`   Using category: ${firstCategory.title} (${firstCategory.slug})`);
      
      // Trigger category scrape
      const scrapeResponse = await axios.post(`${API_URL}/scrape/category/${firstCategory.slug}`);
      console.log(`   ✅ API Response: ${scrapeResponse.data}`);
      
      console.log('\n4. Waiting 30 seconds for scraping...');
      console.log('   Check backend logs for progress');
      
      for (let i = 1; i <= 30; i++) {
        process.stdout.write(`   ${i}s... `);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (i % 10 === 0) {
          // Check products for this category
          try {
            const products = await axios.get(`${API_URL}/categories/${firstCategory.slug}/products`);
            console.log(`\n   Products found: ${products.data.length}`);
          } catch (err) {
            // Ignore
          }
        }
      }
      
      console.log('\n\n5. Final check...');
      const finalProducts = await axios.get(`${API_URL}/categories/${firstCategory.slug}/products`);
      console.log(`   Final product count: ${finalProducts.data.length}`);
      
      if (finalProducts.data.length > 0) {
        console.log('\n🎉 SUCCESS! Products are being scraped and saved via API!');
        console.log('\nSample product:');
        console.log(`   Title: ${finalProducts.data[0].title}`);
        console.log(`   Price: ${finalProducts.data[0].price}`);
        console.log(`   URL: ${finalProducts.data[0].source_url}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ API error: ${error.message}`);
    if (error.response) {
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  console.log('\n✅ Test complete');
}

testExistingBackend().catch(console.error);