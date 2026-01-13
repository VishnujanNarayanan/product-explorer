# init-db.ps1
Write-Host "=== INITIALIZING DATABASE ===" -ForegroundColor Cyan

# Wait for PostgreSQL to be ready
Write-Host "1. Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$postgresReady = $false

do {
    try {
        $containerName = (docker-compose ps -q postgres 2>$null)
        if ($containerName) {
            $result = docker exec $containerName pg_isready -U admin
            if ($result -like "*accepting connections*") {
                $postgresReady = $true
                Write-Host "   PostgreSQL is ready!" -ForegroundColor Green
                break
            }
        }
    } catch {
        # Ignore errors
    }
    
    $attempt++
    Write-Host "   Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
    if ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 2
    }
} while ($attempt -lt $maxAttempts)

if (-not $postgresReady) {
    Write-Host "❌ PostgreSQL not ready after $maxAttempts attempts" -ForegroundColor Red
    Write-Host "Trying to start PostgreSQL container..." -ForegroundColor Yellow
    
    # Try to start the container
    docker-compose up -d postgres
    Start-Sleep -Seconds 10
    
    # Check again
    $containerName = (docker-compose ps -q postgres 2>$null)
    if (-not $containerName) {
        Write-Host "❌ Failed to start PostgreSQL container" -ForegroundColor Red
        exit 1
    }
}

# 2. Load schema
Write-Host "`n2. Loading database schema..." -ForegroundColor Yellow
if (Test-Path "backend/database/schema.sql") {
    $schemaContent = Get-Content -Path "backend/database/schema.sql" -Raw -Encoding UTF8
    
    # Get container name
    $containerName = (docker-compose ps -q postgres)
    
    # Execute schema
    Write-Host "   Executing schema.sql..." -ForegroundColor Gray
    $schemaContent | docker exec -i $containerName psql -U admin -d wob_explorer
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Schema loaded successfully!" -ForegroundColor Green
    } else {
        Write-Host "   Warning: Schema loading had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ schema.sql not found at: backend/database/schema.sql" -ForegroundColor Red
    exit 1
}

# 3. Verify setup
Write-Host "`n3. Verifying database setup..." -ForegroundColor Yellow
$verifyQuery = @"
SELECT 
    (SELECT COUNT(*) FROM navigation) as navigation_count,
    (SELECT COUNT(*) FROM category) as category_count,
    (SELECT COUNT(*) FROM product) as product_count,
    (SELECT COUNT(*) FROM scraper_session) as scraper_sessions;
"@

$containerName = (docker-compose ps -q postgres)
$result = docker exec $containerName psql -U admin -d wob_explorer -t -c "$verifyQuery"

if ($result) {
    Write-Host "`nDatabase Statistics:" -ForegroundColor Cyan
    $result -split "`n" | ForEach-Object {
        if ($_.Trim() -ne "") {
            $parts = $_ -split '\|'
            if ($parts.Count -eq 4) {
                Write-Host "   Navigations: $($parts[0].Trim())" -ForegroundColor Gray
                Write-Host "   Categories: $($parts[1].Trim())" -ForegroundColor Gray
                Write-Host "   Products: $($parts[2].Trim())" -ForegroundColor Gray
                Write-Host "   Scraper Sessions: $($parts[3].Trim())" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "   Could not verify database" -ForegroundColor Yellow
}

# 4. Check Redis
Write-Host "`n4. Checking Redis..." -ForegroundColor Yellow
$redisContainer = (docker-compose ps -q redis)
if ($redisContainer) {
    $redisResult = docker exec $redisContainer redis-cli ping
    if ($redisResult -eq "PONG") {
        Write-Host "   Redis is running (PONG)" -ForegroundColor Green
    } else {
        Write-Host "   Redis ping failed: $redisResult" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Redis container not found" -ForegroundColor Yellow
}

Write-Host "`n✅ DATABASE INITIALIZATION COMPLETE!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Install dependencies:" -ForegroundColor Yellow
Write-Host "   cd backend && npm install @nestjs/websockets @nestjs/platform-socket.io socket.io socket.io-client ws" -ForegroundColor White
Write-Host "   cd ../frontend && npm install socket.io-client" -ForegroundColor White

Write-Host "`n2. Start services:" -ForegroundColor Yellow
Write-Host "   Terminal 1 (Backend): cd backend && npm run start:dev" -ForegroundColor White
Write-Host "   Terminal 2 (Frontend): cd frontend && npm run dev" -ForegroundColor White

Write-Host "`n3. Open browser:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000" -ForegroundColor White

Write-Host "`n4. Test WebSocket:" -ForegroundColor Yellow
Write-Host "   Open browser console and look for 'WebSocket connected'" -ForegroundColor White

Write-Host "`nNote: Backend runs on port 3001, Frontend on port 3000" -ForegroundColor Magenta