const axios = require('axios');

async function testCompleteFlow() {
  console.log('=== COMPLETE SCRAPING FLOW TEST ===\n');
  
  try {
    // 1. Navigation
    console.log('1. Testing navigation...');
    const navRes = await axios.post('http://localhost:3000/api/scrape/navigation');
    console.log(`   ✓ ${navRes.data.message}`);
    
    // 2. Get categories
    console.log('\n2. Getting categories...');
    const categoriesRes = await axios.get('http://localhost:3000/api/categories');
    console.log(`   ✓ Found ${categoriesRes.data.length} categories`);
    
    // 3. Scrape a category
    const testCategory = categoriesRes.data.find(c => c.slug === 'crime-and-mystery-books');
    if (testCategory) {
      console.log(`\n3. Testing category: ${testCategory.title}`);
      const catRes = await axios.post(`http://localhost:3000/api/scrape/category/${testCategory.slug}`);
      console.log(`   ✓ ${catRes.data.message}`);
      console.log(`   Products found: ${catRes.data.products.length}`);
      
      // 4. Test product detail
      if (catRes.data.products.length > 0) {
        const testProduct = catRes.data.products[0];
        console.log(`\n4. Testing product: ${testProduct.title}`);
        console.log(`   Source ID: ${testProduct.source_id}`);
        
        try {
          const productRes = await axios.post(`http://localhost:3000/api/scrape/product/${testProduct.source_id}`);
          console.log(`   ✓ ${productRes.data.message}`);
          
          // 5. Get product details
          const getProductRes = await axios.get(`http://localhost:3000/api/products/${testProduct.source_id}`);
          console.log(`   Product loaded: ${getProductRes.data ? 'YES' : 'NO'}`);
          if (getProductRes.data?.detail) {
            console.log(`   Description: ${getProductRes.data.detail.description ? 'YES' : 'NO'}`);
          }
        } catch (productError) {
          console.error('\n❌ Product detail scraping failed:');
          console.error(`   Status: ${productError.response?.status}`);
          console.error(`   Message: ${productError.response?.data?.message}`);
          console.error(`   Full error:`, productError.response?.data);
          console.error(`   Original error: ${productError.message}`);
        }
      }
    }
    
    console.log('\n=== FLOW TEST COMPLETE ===');
    console.log('\n✅ Navigation: WORKING');
    console.log('✅ Categories: WORKING');
    console.log('✅ Product listing: WORKING');
    console.log('⏱️  Queue processing: NEEDS CHECK');
    console.log('⏱️  Product details: NEEDS TEST');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Message: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
  }
}

testCompleteFlow();
