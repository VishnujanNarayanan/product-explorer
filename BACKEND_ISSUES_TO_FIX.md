# Backend Scraping Logic Issues - To Fix

## 🔴 Critical Issue: Categories Mismatch

### Problem
When clicking on navigation items, the categories displayed are different from what's actually on World of Books website.

### Root Cause
The backend scraping logic is likely:
1. Not filtering categories correctly by navigation item
2. Scraping all categories instead of per-navigation categories
3. Not storing the navigation_id relationship properly

### What Needs to be Fixed in Backend

#### 1. **Category Scraping Logic** (in `backend/src/modules/scraper/scraper.service.ts`)

```typescript
// WRONG - Scraping all categories globally
const allCategories = await scrapeAllCategories(navigationUrl);

// RIGHT - Scrape categories specific to each navigation item
const navigationCategories = await scrapeNavigationSpecificCategories(navigationUrl);
```

#### 2. **Database Relationship** (ensure proper FK constraint)

```typescript
// Verify category entity has proper relationship:
@Entity('category')
export class Category {
  @Column()
  navigation_id: number; // Must link to specific navigation
  
  @ManyToOne(() => Navigation)
  @JoinColumn({ name: 'navigation_id' })
  navigation: Navigation;
}

// When fetching:
categories = await this.categoryRepository.find({
  where: { navigation_id: navId }, // IMPORTANT!
  relations: ['navigation']
});
```

#### 3. **Scraping Process** (correct order)

```typescript
// CORRECT FLOW:
1. Scrape navigation headings (8 items)
2. For each navigation item:
   a. Navigate to that section
   b. Scrape ONLY categories in that section
   c. Save with correct navigation_id
   d. Store category_id for products scraping

// NOT:
- Don't scrape all categories globally
- Don't mix categories from different sections
- Don't forget navigation_id when saving
```

#### 4. **API Endpoint** (ensure it filters by navigation)

Currently in `backend/src/modules/products/products.controller.ts`:

```typescript
@Get('categories')
async getCategories(@Query('navigation') navigationSlug?: string) {
  if (!navigationSlug) {
    return this.categoriesService.findAll(); // All categories - WRONG
  }
  
  // CORRECT:
  return this.categoriesService.findByNavigation(navigationSlug);
}
```

**Should be:**

```typescript
@Get('categories')
async getCategories(@Query('navigation') navigationSlug: string) {
  if (!navigationSlug) {
    throw new BadRequestException('Navigation slug is required');
  }
  
  return this.categoriesService.findByNavigation(navigationSlug);
}
```

#### 5. **Categories Service** (verify filtering)

```typescript
// In categories.service.ts
async findByNavigation(navigationSlug: string) {
  const navigation = await this.navigationRepository.findOne({
    where: { slug: navigationSlug }
  });
  
  if (!navigation) {
    throw new NotFoundException('Navigation not found');
  }
  
  return this.categoryRepository.find({
    where: { 
      navigation_id: navigation.id // CRITICAL!
    },
    relations: ['navigation'],
    order: { created_at: 'DESC' }
  });
}
```

## 📋 World of Books Structure (Verify)

When you visit: `https://www.worldofbooks.com/`

You should see 8 main navigation headings. **For each one**, they have DIFFERENT categories underneath:

### Fiction Books
- Action & Adventure
- Contemporary Romance
- Dark Romance
- Fantasy
- etc.

### Non-Fiction Books
- Biography & Memoir
- Business & Economics
- History
- Science & Nature
- etc.

### Children's Books
- Baby & Toddler
- Early Readers
- Middle Grade
- Young Adult
- etc.

**These categories are NOT the same across nav items!**

## 🔧 Testing Checklist

After fixing backend:

- [ ] GET `/navigation` returns 8 items ✓
- [ ] GET `/categories?navigation=fiction-books` returns ~15 categories
- [ ] GET `/categories?navigation=non-fiction-books` returns DIFFERENT ~15 categories
- [ ] Each category has correct `navigation_id`
- [ ] GET `/categories/{slug}/products` returns products from that specific category
- [ ] No "0" products showing
- [ ] Frontend shows correct categories when nav item clicked

## 🐛 Debugging Steps

1. **Check what's being scraped:**
   ```bash
   # Query DB directly
   SELECT DISTINCT navigation_id, COUNT(*) as count 
   FROM category 
   GROUP BY navigation_id;
   
   # Check if categories are mixed:
   SELECT * FROM category 
   WHERE title LIKE '%Action%' OR title LIKE '%Biography%'
   ORDER BY navigation_id;
   ```

2. **Check scraping logs:**
   - Look for console output during category scraping
   - Check if navigation_id is being set
   - Verify URLs being scraped per navigation

3. **Test API directly:**
   ```bash
   # Should be different:
   curl http://localhost:3000/categories?navigation=fiction-books
   curl http://localhost:3000/categories?navigation=non-fiction-books
   ```

4. **Check World of Books structure:**
   - Manually browse each nav section
   - Verify categories are different
   - Check if they have dropdown subcategories

## 📌 Important Notes

1. **Don't scrape globally** - Each nav item has unique categories
2. **Preserve relationships** - Always store `navigation_id` with category
3. **Filter correctly** - API must filter by navigation_id
4. **Test thoroughly** - Verify each nav item shows different categories
5. **Update data** - May need to re-scrape with corrected logic

## 🚀 Once Fixed

Frontend will automatically:
- Show correct categories per nav item
- Display proper product counts
- Load products correctly
- No more category mismatches

## Questions to Check

1. How many total categories do you see in the DB? (Should be 8*~15 = ~120 unique)
2. Are categories grouped by `navigation_id`?
3. Are you scraping each nav section separately?
4. Are categories being deduplicated globally (wrong) or per-nav (right)?
5. Does the navigation-category relationship exist?

**Once you share the DB query results, we can identify the exact issue!**
