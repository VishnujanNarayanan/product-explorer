--- backend/database/schema.sql
-- Create tables with IF NOT EXISTS for idempotent setup

-- ========== EXISTING TABLES (KEEP THESE) ==========
CREATE TABLE IF NOT EXISTS navigation (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  product_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  navigation_id INTEGER REFERENCES navigation(id),
  parent_id INTEGER REFERENCES category(id)
);

CREATE TABLE IF NOT EXISTS product (
  id SERIAL PRIMARY KEY,
  source_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'GBP',
  image_url TEXT,
  source_url TEXT UNIQUE NOT NULL,
  last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category_id INTEGER REFERENCES category(id)
);

CREATE TABLE IF NOT EXISTS product_detail (
  product_id INTEGER PRIMARY KEY REFERENCES product(id),
  description TEXT NOT NULL,
  specs JSONB,
  ratings_avg DECIMAL(3, 2),
  reviews_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS review (
  id SERIAL PRIMARY KEY,
  author VARCHAR(255) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  product_id INTEGER REFERENCES product(id)
);

CREATE TABLE IF NOT EXISTS scrape_job (
  id SERIAL PRIMARY KEY,
  target_url TEXT NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  error_log TEXT,
  priority VARCHAR(20) DEFAULT 'medium'  -- ADDED: for queue priority
);

CREATE TABLE IF NOT EXISTS view_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  session_id VARCHAR(255) NOT NULL,
  path_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== NEW TABLES FOR WEB SOCKET ==========
CREATE TABLE IF NOT EXISTS scraper_session (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  current_url VARCHAR(500),
  browser_state JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  stats JSONB DEFAULT '{"total_products_scraped": 0, "load_more_count": 0}'::jsonb
);

-- ========== INDEXES ==========
DO $$ 
BEGIN
  -- Product indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_source_id') THEN
    CREATE INDEX idx_product_source_id ON product(source_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_category') THEN
    CREATE INDEX idx_product_category ON product(category_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_last_scraped') THEN
    CREATE INDEX idx_product_last_scraped ON product(last_scraped_at);
  END IF;
  
  -- Category indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_category_slug') THEN
    CREATE INDEX idx_category_slug ON category(slug);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_category_parent') THEN
    CREATE INDEX idx_category_parent ON category(parent_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_category_navigation') THEN
    CREATE INDEX idx_category_navigation ON category(navigation_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_category_last_scraped') THEN
    CREATE INDEX idx_category_last_scraped ON category(last_scraped_at);
  END IF;
  
  -- Review indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_product') THEN
    CREATE INDEX idx_review_product ON review(product_id);
  END IF;
  
  -- Scrape job indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scrape_job_status') THEN
    CREATE INDEX idx_scrape_job_status ON scrape_job(status);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scrape_job_priority') THEN
    CREATE INDEX idx_scrape_job_priority ON scrape_job(priority);
  END IF;
  
  -- View history indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_view_history_session') THEN
    CREATE INDEX idx_view_history_session ON view_history(session_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_view_history_created') THEN
    CREATE INDEX idx_view_history_created ON view_history(created_at);
  END IF;
  
  -- Scraper session indexes (NEW)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scraper_session_session_id') THEN
    CREATE INDEX idx_scraper_session_session_id ON scraper_session(session_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scraper_session_last_active') THEN
    CREATE INDEX idx_scraper_session_last_active ON scraper_session(last_active);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scraper_session_status') THEN
    CREATE INDEX idx_scraper_session_status ON scraper_session(status);
  END IF;
END $$;

-- ========== FALLBACK DATA ==========
-- Insert CORRECT fallback data (8 navigation items as per World of Books)
INSERT INTO navigation (title, slug) VALUES 
  ('Clearance', 'clearance'),
  ('eGift Cards', 'egift-cards'),
  ('Fiction Books', 'fiction-books'),
  ('Non-Fiction Books', 'non-fiction-books'),
  ('Children''s Books', 'childrens-books'),
  ('Rare Books', 'rare-books'),
  ('Music & Film', 'music-film'),
  ('Sell Your Books', 'sell-your-books')
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title;

-- Insert fallback categories for Fiction Books (as example)
INSERT INTO category (title, slug, navigation_id) VALUES
  ('Crime & Mystery', 'crime-mystery', (SELECT id FROM navigation WHERE slug = 'fiction-books')),
  ('Fantasy', 'fantasy', (SELECT id FROM navigation WHERE slug = 'fiction-books')),
  ('Science Fiction', 'science-fiction', (SELECT id FROM navigation WHERE slug = 'fiction-books')),
  ('Romance', 'romance', (SELECT id FROM navigation WHERE slug = 'fiction-books')),
  ('Horror & Ghost Stories', 'horror', (SELECT id FROM navigation WHERE slug = 'fiction-books')),
  ('Biographies', 'biographies', (SELECT id FROM navigation WHERE slug = 'non-fiction-books')),
  ('History', 'history', (SELECT id FROM navigation WHERE slug = 'non-fiction-books')),
  ('Art & Photography', 'art-photography', (SELECT id FROM navigation WHERE slug = 'non-fiction-books')),
  ('Picture Books', 'picture-books', (SELECT id FROM navigation WHERE slug = 'childrens-books')),
  ('Activity Books', 'activity-books', (SELECT id FROM navigation WHERE slug = 'childrens-books'))
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, navigation_id = EXCLUDED.navigation_id;

-- Insert fallback products
INSERT INTO product (source_id, title, price, currency, image_url, source_url, category_id) VALUES
  ('WOB-001', 'The Great Gatsby', 12.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/the-great-gatsby', (SELECT id FROM category WHERE slug = 'crime-mystery')),
  ('WOB-002', 'The Very Hungry Caterpillar', 8.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/the-very-hungry-caterpillar', (SELECT id FROM category WHERE slug = 'fantasy')),
  ('WOB-003', 'Sapiens: A Brief History of Humankind', 14.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/sapiens', (SELECT id FROM category WHERE slug = 'science-fiction')),
  ('WOB-004', 'Harry Potter and the Philosopher''s Stone', 9.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/harry-potter', (SELECT id FROM category WHERE slug = 'fantasy')),
  ('WOB-005', 'The Hobbit', 11.50, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/the-hobbit', (SELECT id FROM category WHERE slug = 'fantasy')),
  ('WOB-006', '1984', 10.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/1984', (SELECT id FROM category WHERE slug = 'science-fiction')),
  ('WOB-007', 'Pride and Prejudice', 7.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/pride-prejudice', (SELECT id FROM category WHERE slug = 'romance')),
  ('WOB-008', 'The Shining', 13.25, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/the-shining', (SELECT id FROM category WHERE slug = 'horror')),
  ('WOB-009', 'The Da Vinci Code', 8.50, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/da-vinci-code', (SELECT id FROM category WHERE slug = 'crime-mystery')),
  ('WOB-010', 'A Brief History of Time', 12.75, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/en-gb/products/brief-history-time', (SELECT id FROM category WHERE slug = 'science-fiction'))
ON CONFLICT (source_id) DO UPDATE SET 
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  source_url = EXCLUDED.source_url,
  category_id = EXCLUDED.category_id;