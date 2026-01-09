-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS review CASCADE;
DROP TABLE IF EXISTS product_detail CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS category CASCADE;
DROP TABLE IF EXISTS navigation CASCADE;
DROP TABLE IF EXISTS scrape_job CASCADE;
DROP TABLE IF EXISTS view_history CASCADE;

-- Navigation table
CREATE TABLE navigation (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category table
CREATE TABLE category (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  product_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  navigation_id INTEGER REFERENCES navigation(id),
  parent_id INTEGER REFERENCES category(id)
);

-- Product table
CREATE TABLE product (
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

-- Product detail table
CREATE TABLE product_detail (
  product_id INTEGER PRIMARY KEY REFERENCES product(id),
  description TEXT NOT NULL,
  specs JSONB,
  ratings_avg DECIMAL(3, 2),
  reviews_count INTEGER DEFAULT 0
);

-- Review table
CREATE TABLE review (
  id SERIAL PRIMARY KEY,
  author VARCHAR(255) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  product_id INTEGER REFERENCES product(id)
);

-- Scrape job table
CREATE TABLE scrape_job (
  id SERIAL PRIMARY KEY,
  target_url TEXT NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  error_log TEXT
);

-- View history table
CREATE TABLE view_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  session_id VARCHAR(255) NOT NULL,
  path_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_product_source_id ON product(source_id);
CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_last_scraped ON product(last_scraped_at);
CREATE INDEX idx_category_slug ON category(slug);
CREATE INDEX idx_category_parent ON category(parent_id);
CREATE INDEX idx_review_product ON review(product_id);
CREATE INDEX idx_scrape_job_status ON scrape_job(status);
CREATE INDEX idx_view_history_session ON view_history(session_id);
CREATE INDEX idx_view_history_created ON view_history(created_at);

-- Insert fallback data for testing
INSERT INTO navigation (title, slug) VALUES 
  ('Books', 'books'),
  ('Children''s Books', 'childrens-books'),
  ('Fiction', 'fiction'),
  ('Non-Fiction', 'non-fiction');

INSERT INTO category (title, slug, navigation_id) VALUES
  ('Fiction', 'fiction', 1),
  ('Non-Fiction', 'non-fiction', 1),
  ('Picture Books', 'picture-books', 2),
  ('Young Adult', 'young-adult', 2);

INSERT INTO product (source_id, title, price, currency, image_url, source_url, category_id) VALUES
  ('WOB-001', 'The Great Gatsby', 12.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/book1', 1),
  ('WOB-002', 'The Very Hungry Caterpillar', 8.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/book2', 3),
  ('WOB-003', 'Sapiens: A Brief History of Humankind', 14.99, 'GBP', 'https://via.placeholder.com/150', 'https://worldofbooks.com/book3', 2);