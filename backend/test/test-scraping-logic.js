// test-scraping-logic.js - Standalone test
const { PlaywrightCrawler } = require('crawlee');
const fs = require('fs');

async function testWorldOfBooksScraping() {
  console.log('🌐 Testing World of Books Scraping Logic\n');
  
  const results = {
    navigation: [],
    categories: [],
    debug: {}
  };
  
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 5,
    maxConcurrency: 1,
    
    launchContext: {
      launchOptions: {
        headless: true, // Set to false to see browser
      },
    },
    
    requestHandler: async ({ page, request }) => {
      console.log(`🔗 Loading: ${request.url}`);
      console.log(`📄 Title: "${await page.title()}"\n`);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // Wait for JavaScript to execute
      
      // DEBUG: Save page HTML for analysis
      const html = await page.content();
      fs.writeFileSync('page-debug.html', html);
      console.log('💾 Saved page HTML to: page-debug.html\n');
      
      // DEBUG: Take screenshot
      await page.screenshot({ path: 'page-screenshot.png', fullPage: true });
      console.log('📸 Screenshot saved: page-screenshot.png\n');
      
      console.log('🔍 Analyzing page structure...\n');
      
      // 1. Find all navigation elements
      console.log('1. NAVIGATION ANALYSIS:');
      const navElements = await page.$$('nav, [role="navigation"], .navigation, .main-nav, .primary-nav');
      console.log(`   Found ${navElements.length} navigation containers\n`);
      
      for (let i = 0; i < navElements.length; i++) {
        const nav = navElements[i];
        
        // Get navigation HTML structure
        const navHtml = await nav.evaluate(el => el.outerHTML.substring(0, 500) + '...');
        console.log(`   Nav ${i + 1} (first 500 chars):`);
        console.log(`   ${navHtml}\n`);
        
        // Find links in this nav
        const links = await nav.$$eval('a', anchors => 
          anchors.map(a => ({
            text: a.textContent?.trim(),
            href: a.href,
            class: a.className,
            id: a.id
          })).filter(link => link.text && link.text.length > 0)
        );
        
        console.log(`   Contains ${links.length} links\n`);
        
        if (links.length > 0) {
          console.log('   Sample links:');
          links.slice(0, 5).forEach((link, idx) => {
            console.log(`     ${idx + 1}. "${link.text}"`);
            console.log(`        href: ${link.href}`);
            if (link.class) console.log(`        class: ${link.class}`);
          });
          console.log();
        }
      }
      
      // 2. Try YOUR specific selectors
      console.log('2. TESTING YOUR SELECTORS:');
      
      const yourSelectors = {
        'nav': 'nav element',
        '.list-menu.list-menu--inline.hide-carets': 'Your NAV_LIST',
        '.has-submenu': 'Your NAV_ITEM',
        '.header__menu-item.list-menu__item.link.link--text.focus-inset': 'Your NAV_LINK',
        '.onstate-mega-menu__submenu': 'Your DROPDOWN',
        '.onstate-mega-menu__submenu__links .list-menu .list-menu a': 'Your SUBCATEGORY_LINKS'
      };
      
      for (const [selector, description] of Object.entries(yourSelectors)) {
        const elements = await page.$$(selector);
        console.log(`   ${description} ("${selector}"): ${elements.length} found`);
        
        if (elements.length > 0 && elements.length <= 3) {
          for (let j = 0; j < elements.length; j++) {
            const text = await elements[j].textContent();
            console.log(`      Item ${j + 1}: "${text?.substring(0, 50)}..."`);
          }
        }
      }
      
      console.log('\n3. FINDING ACTUAL NAVIGATION ITEMS:');
      
      // Look for common navigation patterns on e-commerce sites
      const commonNavPatterns = [
        'Books',
        'Categories', 
        'Fiction',
        'Non-Fiction',
        'Children',
        'Best Sellers',
        'New Arrivals',
        'Sale'
      ];
      
      // Find links that match common patterns
      const allLinks = await page.$$eval('a', anchors => 
        anchors.map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          class: a.className
        }))
      );
      
      const navCandidates = allLinks.filter(link => 
        link.text && commonNavPatterns.some(pattern => 
          link.text.toLowerCase().includes(pattern.toLowerCase())
        )
      );
      
      console.log(`   Found ${navCandidates.length} potential navigation items`);
      
      if (navCandidates.length > 0) {
        console.log('\n   Potential navigation:');
        navCandidates.slice(0, 10).forEach((link, i) => {
          console.log(`   ${i + 1}. "${link.text}"`);
          console.log(`      → ${link.href}`);
          if (link.class) console.log(`      [${link.class}]`);
        });
        
        // Add to results
        results.navigation = navCandidates.map(link => ({
          title: link.text,
          url: link.href,
          slug: link.href.split('/').filter(Boolean).pop() || 'home'
        }));
      }
      
      console.log('\n✅ Page analysis complete!\n');
    },
    
    failedRequestHandler: async ({ request, error }) => {
      console.error(`❌ Failed to scrape ${request.url}:`, error?.message || error);
    }
  });
  
  try {
    console.log('Starting comprehensive scraping test...\n');
    await crawler.run([{
      url: 'https://www.worldofbooks.com/',
      uniqueKey: 'comprehensive-test',
      userData: { depth: 0 }
    }]);
    
    console.log('='.repeat(60));
    console.log('🎯 SCRAPING TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Navigation items found: ${results.navigation.length}`);
    console.log(`Check generated files:`);
    console.log(`  📄 page-debug.html - Full page HTML for analysis`);
    console.log(`  📸 page-screenshot.png - Visual reference`);
    console.log('\n💡 Next steps:');
    console.log('1. Open page-debug.html to see actual HTML structure');
    console.log('2. Check which of your selectors matched elements');
    console.log('3. Update selectors in navigation.scraper.ts if needed');
    console.log('='.repeat(60));
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Comprehensive test failed:', error.message);
    throw error;
  }
}

// Run the test
testWorldOfBooksScraping().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});