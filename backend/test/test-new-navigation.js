const { NavigationScraper } = require('../dist/modules/scraper/scrapers/navigation.scraper');

async function testNewNavigation() {
  console.log('=== TESTING UPDATED NAVIGATION SCRAPER ===\n');
  
  const scraper = new NavigationScraper();
  
  // Mock logger
  scraper.logger = {
    log: (msg) => console.log(`[LOG] ${msg}`),
    debug: (msg) => console.log(`[DEBUG] ${msg}`),
    warn: (msg) => console.log(`[WARN] ${msg}`),
    error: (msg) => console.log(`[ERROR] ${msg}`)
  };
  
  try {
    console.log('Running updated scrape() method...\n');
    const startTime = Date.now();
    const result = await scraper.scrape('https://www.worldofbooks.com');
    const endTime = Date.now();
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Time taken: ${(endTime - startTime) / 1000} seconds`);
    console.log(`Navigation items: ${result.navigation.length}`);
    console.log(`Categories: ${result.categories.length}`);
    
    // Check if we got the expected 8 items
    console.log('\n=== CHECKING FOR 8 MAIN NAV ITEMS ===');
    const expectedItems = [
      'Clearance', 'eGift Cards', 'Fiction Books', 'Non-Fiction Books',
      'Children\'s Books', 'Rare Books', 'Music & Film', 'Sell Your Books'
    ];
    
    let foundCount = 0;
    expectedItems.forEach(expected => {
      const found = result.navigation.find(nav => 
        nav.title.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(nav.title.toLowerCase())
      );
      console.log(`✓ "${expected}": ${found ? 'FOUND' : 'NOT FOUND'}`);
      if (found) foundCount++;
    });
    
    console.log(`\nFound ${foundCount}/8 expected navigation items`);
    
    // Show what we actually got
    console.log('\n=== ACTUAL NAVIGATION ITEMS FOUND ===');
    result.navigation.forEach((item, i) => {
      console.log(`${i+1}. "${item.title}" -> ${item.slug}`);
      console.log(`   URL: ${item.url}`);
      console.log(`   Has Children: ${item.hasChildren}`);
      console.log('');
    });
    
    // Show category relationships
    console.log('\n=== SAMPLE CATEGORY RELATIONSHIPS ===');
    const sampleCategories = result.categories.slice(0, 10);
    sampleCategories.forEach((cat, i) => {
      console.log(`${i+1}. "${cat.title}"`);
      console.log(`   Parent: ${cat.parentSlug || 'none'}`);
      console.log(`   URL: ${cat.url}`);
      console.log('');
    });
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('new-navigation-results.json', JSON.stringify(result, null, 2));
    console.log('\nResults saved to: new-navigation-results.json');
    
  } catch (error) {
    console.error('TEST FAILED:', error);
    console.error('Stack:', error.stack);
  }
}

testNewNavigation().catch(console.error);