# Frontend Navigation Flow - Visual Guide

## Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOME PAGE (/)                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  World of Books Explorer                                │   │
│  │  [Refresh Navigation Button]                            │   │
│  │  Loading... (shows spinner)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              NAVIGATION GRID (8 Items)                  │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Fiction      │  │ Non-Fiction  │  │ Children's   │  │   │
│  │  │ Books        │  │ Books        │  │ Books        │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ 📚 Hover to  │  │ 📚 Hover to  │  │ 📚 Hover to  │  │   │
│  │  │ see dropdown │  │ see dropdown │  │ see dropdown │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ [Explore]    │  │ [Explore]    │  │ [Explore]    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Rare Books   │  │ Music & Film │  │ eGift Cards  │  │   │
│  │  │              │  │              │  │ (No dropdown)│  │   │
│  │  │ 📚 Hover to  │  │ 📚 Hover to  │  │              │  │   │
│  │  │ see dropdown │  │ see dropdown │  │ No dropdown  │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ [Explore]    │  │ [Explore]    │  │ [Explore]    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                         │   │
│  │ ... + 2 more items                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Quick Stats: 8 Sections | Total Categories | Live | 1000+ Books
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        Click [Explore]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CATEGORIES PAGE (/categories)                      │
│                                                                 │
│ Home › Fiction Books                                            │
│                                                                 │
│ ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│ │ SIDEBAR:            │  │                                  │  │
│ │                     │  │  Fiction Books                   │  │
│ │ Navigation Items    │  │  Browse categories in this...    │  │
│ │                     │  │                                  │  │
│ │ ☑ Fiction Books     │  │  [Refresh Categories Button]     │  │
│ │ ○ Non-Fiction       │  │                                  │  │
│ │ ○ Children's        │  │  ┌────────────┐  ┌────────────┐ │  │
│ │ ○ Rare Books        │  │  │ Category 1 │  │ Category 2 │ │  │
│ │ ○ Music & Film      │  │  │ 45 items   │  │ 52 items   │ │  │
│ │ ○ Clearance         │  │  └────────────┘  └────────────┘ │  │
│ │ ○ eGift Cards       │  │                                  │  │
│ │ ○ Sell Your Books   │  │  ┌────────────┐  ┌────────────┐ │  │
│ │                     │  │  │ Category 3 │  │ Category 4 │ │  │
│ │                     │  │  │ 38 items   │  │ 61 items   │ │  │
│ │                     │  │  └────────────┘  └────────────┘ │  │
│ │                     │  │                                  │  │
│ │ * Click to switch   │  │  ... more categories             │  │
│ │   nav item          │  │                                  │  │
│ └─────────────────────┘  └──────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        Click Category
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               PRODUCTS PAGE (/products)                         │
│                                                                 │
│ Home › Fiction Books › Romance Novels                           │
│                                                                 │
│ ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│ │ SIDEBAR:            │  │                                  │  │
│ │                     │  │  Romance Novels                  │  │
│ │ Categories          │  │  Available products in this...   │  │
│ │ From: Fiction Books │  │                                  │  │
│ │                     │  │  [Refresh Products Button]       │  │
│ │ ☑ Romance Novels    │  │                                  │  │
│ │ ○ Sci-Fi            │  │  ┌────────────┐  ┌────────────┐ │  │
│ │ ○ Mystery           │  │  │ 📚          │  │ 📚          │ │  │
│ │ ○ Adventure         │  │  │ Product 1   │  │ Product 2   │ │  │
│ │ ○ Fantasy           │  │  │ £12.99      │  │ £14.99      │ │  │
│ │ ○ Biography         │  │  │ ⭐⭐⭐⭐⭐ │  │ ⭐⭐⭐⭐    │ │  │
│ │                     │  │  └────────────┘  └────────────┘ │  │
│ │                     │  │                                  │  │
│ │                     │  │  ┌────────────┐  ┌────────────┐ │  │
│ │* Click to switch    │  │  │ 📚          │  │ 📚          │ │  │
│ │  category within    │  │  │ Product 3   │  │ Product 4   │ │  │
│ │  same nav item      │  │  │ £11.99      │  │ £13.99      │ │  │
│ │                     │  │  │ ⭐⭐⭐⭐⭐ │  │ ⭐⭐⭐⭐⭐ │ │  │
│ │                     │  │  └────────────┘  └────────────┘ │  │
│ │                     │  │                                  │  │
│ │                     │  │  ... more products               │  │
│ │                     │  │  (48 products total)             │  │
│ └─────────────────────┘  └──────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        Click Product
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            PRODUCT DETAIL PAGE (/products/[id])                 │
│                                                                 │
│ Home › Fiction Books › Romance Novels › Product Title           │
│                                                                 │
│ ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│ │ Product Image       │  │ Product Title                    │  │
│ │                     │  │                                  │  │
│ │ [📚 Large Cover]    │  │ Category: Romance Novels         │  │
│ │                     │  │ Price: £12.99                    │  │
│ │                     │  │ Rating: ⭐⭐⭐⭐⭐ (4.8/5)      │  │
│ │ [⟳ Refresh Button]  │  │ 234 Reviews                      │  │
│ │                     │  │                                  │  │
│ │                     │  │ Description:                     │  │
│ │                     │  │ Lorem ipsum dolor sit amet...    │  │
│ │                     │  │                                  │  │
│ │                     │  │ [View on World of Books Button]  │  │
│ │                     │  │ [Refresh Product Data Button]    │  │
│ └─────────────────────┘  └──────────────────────────────────┘  │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Product Details | Reviews | Related Products                 ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features by Page

### Home Page
- ✅ Shows loading spinner when fetching navigation
- ✅ Auto-scrapes if empty
- ✅ 8 navigation items displayed
- ✅ 5 items have category dropdowns on hover
- ✅ Refresh button to manually trigger scrape
- ✅ Quick stats section

### Categories Page
- ✅ Navigation sidebar to switch between nav items
- ✅ Category grid for selected nav item
- ✅ Shows category count and product availability
- ✅ Refresh button to fetch fresh categories
- ✅ Breadcrumb navigation

### Products Page
- ✅ Category sidebar to switch between categories
- ✅ Shows which nav item the categories belong to
- ✅ Product grid for selected category
- ✅ Refresh button to fetch fresh products
- ✅ Shows total product count
- ✅ Breadcrumb navigation

### Product Detail Page
- ✅ Shows full product information
- ✅ Refresh button to scrape fresh data
- ✅ Reviews section
- ✅ Related products
- ✅ Breadcrumb navigation

## Caching Strategy

### Level 1: Navigation
- Cache checked first
- If empty → triggers scrape
- Frontend shows loading state

### Level 2: Categories
- Cached per navigation item
- If missing for nav item → triggers scrape
- Shows loading state

### Level 3: Products
- Cached per category
- If missing for category → triggers scrape
- Shows loading state

### Level 4: Product Details
- Individual product scraping
- Fresh scrape always available via refresh button
- Background scraping can be configured on backend

## User Journey Example

```
1. User visits home page
   → Backend returns cached nav items
   → If empty, scrapes fresh
   → Shows loading spinner while scraping

2. User hovers over "Fiction Books" nav item
   → Dropdown shows categories
   → Displays count: "123 products available"

3. User clicks "Explore" on Fiction Books
   → Navigates to /categories?navigation=fiction-books
   → Shows all categories for Fiction Books
   → Sidebar shows other nav items for quick switching

4. User clicks "Romance Novels" category
   → Navigates to /products?category=romance-novels&navigation=fiction-books
   → Shows all products in Romance Novels
   → Sidebar shows all categories for Fiction Books
   → Can switch to different category without losing nav context

5. User clicks on a product
   → Navigates to /products/[source_id]
   → Shows full product details
   → Can refresh to get fresh data
   → Can view related products

6. At any point, user can:
   → Click refresh to manually scrape fresh data
   → Switch nav item from sidebar
   → Switch category from sidebar
   → Go back via breadcrumbs
```

## Responsive Design

```
Desktop (1200px+)
├── Full sidebar + content
├── 4-column product grid
└── Sticky sidebars

Tablet (768px - 1200px)
├── Sidebar collapses/stacks
├── 2-3 column product grid
└── Touch-friendly buttons

Mobile (<768px)
├── Sidebar becomes dropdown/drawer
├── 1-2 column product grid
├── Bottom navigation
└── Optimized touch targets
```
