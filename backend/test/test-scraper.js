// test-scraper.js - Enhanced test script
const { NestFactory } = require('@nestjs/core');
const { ScraperModule } = require('../dist/modules/scraper/scraper.module');
const { NavigationScraper } = require('../dist/modules/scraper/scrapers/navigation.scraper');

async function testDirectScraper() {
  console.log('🚀 Testing NavigationScraper directly...\n');
  
  try {
    // Create minimal app context
    const app = await NestFactory.createApplicationContext(ScraperModule);
    const scraper = app.get(NavigationScraper);
    
    console.log('Starting scrape of World of Books homepage...');
    console.log('URL: https://www.worldofbooks.com/\n');
    
    // FIXED: Pass the URL parameter
    const result = await scraper.scrape('https://www.worldofbooks.com/');
    
    console.log('✅ SUCCESS! Scraping completed:');
    console.log(`📊 Found ${result.navigation.length} navigation items`);
    console.log(`📊 Found ${result.categories.length} categories\n`);
    
    // Show navigation items
    console.log('📌 NAVIGATION ITEMS:');
    result.navigation.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`);
      console.log(`     Slug: ${item.slug}`);
      console.log(`     URL: ${item.url}`);
      console.log(`     Has Children: ${item.hasChildren}`);
      console.log('');
    });
    
    // Show some categories
    console.log('📌 SAMPLE CATEGORIES (first 5):');
    result.categories.slice(0, 5).forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.title}`);
      console.log(`     Slug: ${cat.slug}`);
      console.log(`     Parent: ${cat.parentSlug || 'none'}`);
      console.log(`     URL: ${cat.url}`);
      console.log('');
    });
    
    await app.close();
    console.log('🎉 Test completed successfully!');
    return result;
    
  } catch (error) {
    console.error('\n❌ SCRAPER FAILED:', error.message);
    console.error('\n📋 Error Details:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    
    process.exit(1);
  }
}

// Alternative: Simple test without Nest context
async function testSimple() {
  console.log('🧪 Testing with simple approach...\n');
  
  // Note: This may not work if scraper depends on NestJS services
  const scraper = new NavigationScraper();
  
  try {
    const result = await scraper.scrape('https://www.worldofbooks.com/');
    console.log('Simple test result:', {
      navigationCount: result.navigation.length,
      categoryCount: result.categories.length
    });
  } catch (error) {
    console.error('Simple test failed:', error.message);
  }
}

// Run the test
async function main() {
  console.log('='.repeat(60));
  console.log('   PRODUCT EXPLORER - SCRAPER TEST');
  console.log('='.repeat(60));
  
  // Try direct test first
  await testDirectScraper();
  
  // Uncomment to try simple test if above fails
  // await testSimple();
}

main().catch(error => {
  console.error('Fatal error in test:', error);
  process.exit(1);
});