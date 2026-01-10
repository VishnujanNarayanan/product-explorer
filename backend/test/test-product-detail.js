// test-product-detail.js
const { ProductDetailScraper } = require('../dist/modules/scraper/scrapers/product-detail.scraper');

async function testProductDetailScraper() {
  console.log('🧪 Testing Product Detail Scraper with Detailed Logging...\n');
  
  try {
    // Use a known product URL (from your category test results)
    const testProductUrl = 'https://www.worldofbooks.com/en-gb/products/yellowface-book-rebecca-f-kuang-9780008532819';
    const testSourceId = 'WOB-ISBN-9780008532819';
    
    console.log(`Testing with product: Yellowface`);
    console.log(`URL: ${testProductUrl}`);
    console.log(`Source ID: ${testSourceId}\n`);
    
    console.log('⏰ Starting scrape...\n');
    
    const detailScraper = new ProductDetailScraper();
    
    // Add logging to see what's happening
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log = originalLog; // Restore console
        reject(new Error('Product detail test timeout after 90 seconds'));
      }, 90000);
    });
    
    const detailPromise = detailScraper.scrape(testProductUrl, testSourceId);
    const productDetail = await Promise.race([detailPromise, timeoutPromise]);
    
    console.log = originalLog; // Restore console
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PRODUCT DETAIL SCRAPER RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📝 DESCRIPTION:');
    if (productDetail.description) {
      const desc = productDetail.description.length > 300 
        ? productDetail.description.substring(0, 300) + '...' 
        : productDetail.description;
      console.log(desc);
      console.log(`(Length: ${productDetail.description.length} characters)`);
    } else {
      console.log('No description found');
    }
    
    console.log('\n🔧 SPECS:');
    if (productDetail.specs && Object.keys(productDetail.specs).length > 0) {
      Object.entries(productDetail.specs).forEach(([key, value]) => {
        if (value && value !== '0' && value !== '') {
          console.log(`  ${key}: ${value}`);
        }
      });
    } else {
      console.log('  No specs found');
    }
    
    console.log('\n⭐ REVIEWS:');
    if (productDetail.reviews.length > 0) {
      console.log(`  Found ${productDetail.reviews.length} reviews`);
      productDetail.reviews.slice(0, 3).forEach((review, i) => {
        console.log(`\n  Review ${i + 1}:`);
        if (review.text) {
          const text = review.text.length > 150 
            ? review.text.substring(0, 150) + '...' 
            : review.text;
          console.log(`    "${text}"`);
        }
        if (review.author) console.log(`    - ${review.author}`);
        if (review.rating) console.log(`    Rating: ${review.rating}/5`);
      });
    } else {
      console.log('  No reviews found');
    }
    
    console.log('\n🔄 RELATED PRODUCTS:');
    if (productDetail.related_products.length > 0) {
      console.log(`  Found ${productDetail.related_products.length} related products`);
      productDetail.related_products.slice(0, 5).forEach((related, i) => {
        console.log(`  ${i + 1}. ${related.title}`);
        console.log(`     Price: £${related.price.toFixed(2)}`);
        console.log(`     ID: ${related.source_id}`);
      });
    } else {
      console.log('  No related products found');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Description: ${productDetail.description ? '✅' : '❌'} (${productDetail.description?.length || 0} chars)`);
    console.log(`Specs: ${Object.keys(productDetail.specs || {}).length > 0 ? '✅' : '❌'} (${Object.keys(productDetail.specs || {}).length} items)`);
    console.log(`Reviews: ${productDetail.reviews.length > 0 ? '✅' : '❌'} (${productDetail.reviews.length} found)`);
    console.log(`Related Products: ${productDetail.related_products.length > 0 ? '✅' : '❌'} (${productDetail.related_products.length} found)`);
    
    return productDetail;
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ PRODUCT DETAIL SCRAPER FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    
    console.error('\n🔍 Possible issues:');
    console.error('1. Selectors in product-detail.scraper.ts don\'t match the page');
    console.error('2. Page structure is different than expected');
    console.error('3. The product page might have different layout');
    console.error('4. Cookie consent might be blocking');
    
    console.error('\n💡 Debugging steps:');
    console.error('1. Open the product URL in browser');
    console.error('2. Check if elements with these selectors exist:');
    console.error('   - .product-accordion .panel (description)');
    console.error('   - .additional-info-table (specs table)');
    console.error('   - .algolia-related-products-container .main-product-card (related products)');
    
    throw error;
  }
}

// Also test with debug logging enabled
async function testWithDebug() {
  console.log('🚀 Testing Product Detail Scraper with Debug Logging...\n');
  
  // Create a simple test to see what selectors find
  const { PlaywrightCrawler } = require('crawlee');
  
  const testUrl = 'https://www.worldofbooks.com/en-gb/products/yellowface-book-rebecca-f-kuang-9780008532819';
  
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 1,
    
    // @ts-ignore
    requestHandler: async ({ page, request }) => {
      console.log(`🔍 Testing selectors on: ${request.url}\n`);
      
      await page.waitForLoadState('networkidle');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test Product Detail Scraper selectors
      const selectors = {
        'DESCRIPTION (.product-accordion .panel)': '.product-accordion .panel',
        'ADDITIONAL_INFO_TABLE (.additional-info-table)': '.additional-info-table',
        'INFO_ISBN13 (#info-isbn13)': '#info-isbn13',
        'INFO_ISBN10 (#info-isbn10)': '#info-isbn10',
        'INFO_PUBLISHER (#info-publisher)': '#info-publisher',
        'INFO_YEAR_PUBLISHED (#info-year-published)': '#info-year-published',
        'RELATED_PRODUCTS (.algolia-related-products-container .main-product-card)': '.algolia-related-products-container .main-product-card',
        'Any product description': '[class*="description"], [class*="Description"], .product__description, .description-content',
        'Any specs table': 'table, .specs, .specifications, .product-specs',
      };
      
      console.log('Checking selectors:');
      for (const [name, selector] of Object.entries(selectors)) {
        const elements = await page.$$(selector);
        console.log(`  ${name}: ${elements.length} found`);
        
        if (elements.length > 0 && elements.length <= 2) {
          for (let i = 0; i < elements.length; i++) {
            const text = await elements[i].textContent();
            console.log(`    Sample ${i + 1}: "${text?.substring(0, 100)}..."`);
          }
        }
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'product-detail-debug.png' });
      console.log('\n📸 Screenshot saved: product-detail-debug.png');
      
      // Get page HTML structure
      const bodyHtml = await page.evaluate(() => document.body.innerHTML.length);
      console.log(`\nPage HTML size: ${bodyHtml} characters`);
    },
  });
  
  await crawler.run([{ url: testUrl, uniqueKey: 'product-debug' }]);
  console.log('\n✅ Selector debug complete!');
}

// Run the tests
async function main() {
  console.log('='.repeat(70));
  console.log('   PRODUCT DETAIL SCRAPER COMPREHENSIVE TEST');
  console.log('='.repeat(70));
  
  try {
    // First run debug test to see what selectors work
    await testWithDebug();
    
    console.log('\n' + '='.repeat(70));
    console.log('   NOW TESTING ACTUAL PRODUCT DETAIL SCRAPER');
    console.log('='.repeat(70));
    
    // Then test the actual scraper
    await testProductDetailScraper();
    
    console.log('\n🎉 ALL THREE SCRAPERS ARE WORKING!');
    console.log('📋 Ready for BullMQ integration.');
    
  } catch (error) {
    console.error('\n❌ Testing failed. Need to update Product Detail Scraper selectors.');
    console.error('\n💡 Check product-detail-debug.png screenshot to see page structure.');
  }
}

main().catch(console.error);