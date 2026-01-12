# init-db.ps1
Write-Host "=== INITIALIZING DATABASE ===" -ForegroundColor Cyan

# 1. Copy schema to container
Write-Host "1. Copying schema.sql to PostgreSQL container..." -ForegroundColor Yellow
$schemaContent = Get-Content -Path "backend/database/schema.sql" -Raw
docker exec -i product-explorer-postgres-1 psql -U admin -d wob_explorer -c "$schemaContent"

# 2. Insert fallback data
Write-Host "2. Inserting fallback data..." -ForegroundColor Yellow
$seedContent = @"
INSERT INTO navigation (title, slug) VALUES 
  ('Clearance', 'clearance'),
  ('eGift Cards', 'egift-cards'),
  ('Fiction Books', 'fiction-books'),
  ('Non-Fiction Books', 'non-fiction-books'),
  ('Children''s Books', 'childrens-books'),
  ('Rare Books', 'rare-books'),
  ('Music & Film', 'music-film'),
  ('Sell Your Books', 'sell-your-books')
ON CONFLICT (slug) DO NOTHING;
"@
docker exec -i product-explorer-postgres-1 psql -U admin -d wob_explorer -c "$seedContent"

Write-Host "✅ Database initialized successfully!" -ForegroundColor Green
Write-Host "Run: cd backend && npm run start:dev" -ForegroundColor Cyan