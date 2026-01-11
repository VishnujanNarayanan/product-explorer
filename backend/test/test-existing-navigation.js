const { NavigationScraper } = require('../dist/modules/scraper/scrapers/navigation.scraper');
const { BaseScraper } = require('../dist/modules/scraper/scrapers/base.scraper');

async function testExistingScraper() {
  console.log('=== TESTING YOUR EXISTING NAVIGATION SCRAPER ===\n');
  
  try {
    // Create an instance of your scraper
    const scraper = new NavigationScraper();
    
    // Mock the logger (since we're outside NestJS)
    scraper.logger = {
      log: (msg) => console.log(`[LOG] ${msg}`),
      debug: (msg) => console.log(`[DEBUG] ${msg}`),
      warn: (msg) => console.log(`[WARN] ${msg}`),
      error: (msg) => console.log(`[ERROR] ${msg}`)
    };
    
    console.log('Running your scrape() method with World of Books URL...');
    console.log('This will use YOUR current selectors and logic:\n');
    
    console.log('YOUR SELECTORS being used:');
    console.log('- NAV_LIST:', scraper.SELECTORS?.NAV_LIST);
    console.log('- NAV_ITEM:', scraper.SELECTORS?.NAV_ITEM);
    console.log('- DROPDOWN:', scraper.SELECTORS?.DROPDOWN);
    console.log('- SUBCATEGORY_LINKS:', scraper.SELECTORS?.SUBCATEGORY_LINKS);
    console.log('');
    
    // Run your actual scrape method
    const startTime = Date.now();
    const result = await scraper.scrape('https://www.worldofbooks.com');
    const endTime = Date.now();
    
    console.log('\n=== SCRAPING COMPLETED ===');
    console.log(`Time taken: ${(endTime - startTime) / 1000} seconds`);
    console.log(`\nNavigation items found: ${result.navigation.length}`);
    console.log(`Categories found: ${result.categories.length}`);
    
    // Display what was actually scraped
    console.log('\n--- NAVIGATION ITEMS FOUND ---');
    result.navigation.forEach((item, index) => {
      console.log(`${index + 1}. "${item.title}"`);
      console.log(`   Slug: ${item.slug}`);
      console.log(`   URL: ${item.url}`);
      console.log(`   Has Children: ${item.hasChildren}`);
      console.log('');
    });
    
    console.log('\n--- CATEGORIES FOUND ---');
    result.categories.forEach((cat, index) => {
      console.log(`${index + 1}. "${cat.title}"`);
      console.log(`   Slug: ${cat.slug}`);
      console.log(`   Parent: ${cat.parentSlug || '(none)'}`);
      console.log(`   Level: ${cat.level}`);
      console.log('');
    });
    
    // Check if we got the expected items from your image
    console.log('\n=== CHECKING AGAINST EXPECTED ITEMS ===');
    const expectedTopNav = ['Clearance', 'eGift Cards', 'Fiction Books', 'Non-Fiction Books', 
                           'Children\'s Books', 'Rare Books', 'Music & Film', 'Sell Your Books'];
    
    console.log('\nLooking for expected top navigation:');
    expectedTopNav.forEach(expected => {
      const found = result.navigation.find(nav => 
        nav.title.toLowerCase().includes(expected.toLowerCase())
      );
      console.log(`✓ "${expected}": ${found ? 'FOUND' : 'NOT FOUND'}`);
    });
    
    // Check for expected Fiction subcategories
    console.log('\nLooking for Fiction subcategories:');
    const fictionSubcats = ['Crime & Mystery', 'Fantasy', 'Romance', 'Science Fiction'];
    fictionSubcats.forEach(expected => {
      const found = result.categories.find(cat => 
        cat.title.toLowerCase().includes(expected.toLowerCase())
      );
      console.log(`✓ "${expected}": ${found ? 'FOUND' : 'NOT FOUND'}`);
    });
    
    // Check parent-child relationships
    console.log('\n=== CHECKING PARENT-CHILD RELATIONSHIPS ===');
    const fictionNav = result.navigation.find(nav => 
      nav.title.toLowerCase().includes('fiction')
    );
    
    if (fictionNav) {
      console.log(`Found Fiction navigation: "${fictionNav.title}"`);
      const children = result.categories.filter(cat => 
        cat.parentSlug === fictionNav.slug
      );
      console.log(`Has ${children.length} children linked to it:`);
      children.forEach(child => {
        console.log(`  - "${child.title}"`);
      });
    }
    
    // Save results to file for inspection
    const fs = require('fs');
    fs.writeFileSync(
      'navigation-results.json',
      JSON.stringify(result, null, 2)
    );
    console.log('\nFull results saved to: navigation-results.json');
    
  } catch (error) {
    console.error('TEST FAILED WITH ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testExistingScraper().catch(console.error);