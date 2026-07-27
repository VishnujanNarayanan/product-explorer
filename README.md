# Product Data Explorer

A full-stack product exploration platform for [World of Books](https://www.worldofbooks.com/en-gb).
Users drill down from navigation headings → categories → product listings → product detail, with
data fetched by live, on-demand scraping and persisted to PostgreSQL.

```
Navigation headings  →  Categories  →  Product grid  →  Product detail
   (6 headings)         (113 links)     (250 / page)     (specs + related)
```

---

## Stack

**Backend** — NestJS, TypeScript, PostgreSQL (TypeORM), Redis, BullMQ, Crawlee, Playwright, Socket.IO
**Frontend** — Next.js (App Router), React, TypeScript, Tailwind CSS, SWR, Socket.IO client

PostgreSQL was chosen over a document store because the domain is inherently relational — navigation
owns categories, categories own products, products own their detail — and the assignment's uniqueness
requirements (`source_id`, `source_url`) map directly onto SQL constraints used for deduplication.

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 | ships with npm |
| Docker + Docker Compose | any recent | runs PostgreSQL and Redis |
| Playwright Chromium | matched to `playwright` | installed via a command below |

---

## Quick start

```bash
git clone <repository-url>
cd product-explorer

# 1. Environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# 2. Start PostgreSQL + Redis
docker compose up -d postgres redis
```

> Start **only** `postgres` and `redis`. The compose file also declares a `backend` service that
> builds from `backend/Dockerfile`, which does not exist yet — a bare `docker compose up` fails on it.

```bash
# 3. Backend
cd backend
npm ci
npx playwright install chromium     # browser binaries, ~275 MB
npm run start:dev                   # → http://localhost:3001

# 4. Frontend (second terminal)
cd frontend
npm ci
npm run dev                         # → http://localhost:3000
```

The schema is created automatically: `backend/database/schema.sql` is mounted into the Postgres
container's init hook. That hook runs **only when the data volume is first created** — if tables are
missing, reset with `docker compose down -v && docker compose up -d postgres redis`.

On first boot the backend scrapes navigation automatically if the `navigation` table is empty.

### Ports

| Service | Port |
| --- | --- |
| Frontend | 3000 |
| Backend API | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Configuration

All backend variables are documented in [`.env.example`](.env.example), frontend variables in
[`frontend/.env.example`](frontend/.env.example). Real `.env` files are gitignored and no
credentials are committed.

Note the backend reads `.env` from the **repository root**, not `backend/` — `ConfigModule` is
configured with `envFilePath: ['.env', '../.env']`.

---

## API

Base URL `http://localhost:3001`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + database connectivity |
| `GET` | `/api/navigation` | Navigation headings with their categories |
| `GET` | `/api/categories` | All categories |
| `GET` | `/api/categories/:slug` | One category |
| `GET` | `/api/categories/:slug/products` | Products in a category |
| `GET` | `/api/products/:id` | Product with detail and related items |
| `POST` | `/api/scrape/navigation` | Re-scrape navigation |
| `POST` | `/api/scrape/category/:slug` | Queue a listing scrape (returns immediately) |
| `POST` | `/api/scrape/product/:sourceId` | Queue a detail scrape |
| `GET` | `/api/jobs/:id` | Scrape job status |
| `POST` | `/api/cache/clear` | Drop cached responses |

Real-time scrape progress is pushed over Socket.IO on the `/api/ws` namespace.

---

## Scraping design

Three tiers, each triggered on demand and each backed by Crawlee for queueing, retries and backoff.

| Tier | Engine | Source |
| --- | --- | --- |
| Navigation + categories | Crawlee **Playwright** | mega-menu markup on `/en-gb` |
| Product listings | Crawlee **HttpCrawler** | `/collections/<slug>/products.json` |
| Product detail | Crawlee **Playwright** | schema.org JSON-LD + `#info-*` table |
| Related products | Crawlee **HttpCrawler** | `/recommendations/products.json` |

### Why listings use the JSON feed

Category pages render their product grid through **Algolia InstantSearch on the client**. In a
headless browser the grid never resolves past `#skeleton-loader`, so DOM scraping of the listing
page returns nothing regardless of selector. Shopify publishes the same catalogue as structured
JSON, which `robots.txt` permits, so listings read that instead — via Crawlee's `HttpCrawler`, so
the queueing, retry and rate-limiting behaviour is identical to the browser-driven tiers.

Detail pages are still scraped with a real browser, since their JSON-LD and spec table are
server-rendered.

### Progressive filling and caching

Listings are not bulk-downloaded. Each category stores a checkpoint (`last_page_scraped`,
`is_exhausted`); every visit fetches the next page and advances it, so revisiting a category
continues where the previous run stopped rather than re-fetching. Once a short page proves the
collection is finished, the category is marked exhausted and stops issuing requests entirely.

Detail scraping is **lazy** — it runs only when a user opens a specific product.

Caching rules: results are cached in Redis with an explicit TTL, and **empty or failed scrapes are
never cached**, so a transient failure cannot mask itself as a valid empty result for the whole TTL.

### Reviews

World of Books product pages contain **no review or rating markup** — verified by scanning for
`[class*="rating"]`, `[class*="review"]`, `[class*="star"]` and `[data-rating]`, all of which match
zero elements. The `review` table exists in the schema, but is intentionally left unpopulated and
`ratings_avg` stays null. The alternative — synthesising reviews from marketing copy — would put
fabricated data in front of users.

### Ethical scraping

- `robots.txt` is respected. Disallowed `sort_by` / `filter` collection URLs are never requested.
- 3s default delay between sequential requests, single concurrency per scrape.
- Retries with Crawlee's exponential backoff, capped by `SCRAPE_RETRY_COUNT`.
- Caching, checkpointing and the exhausted flag exist specifically to avoid repeat traffic.
- A complete, honest User-Agent is sent.

---

## Database schema

`backend/database/schema.sql`

| Table | Purpose |
| --- | --- |
| `navigation` | Top-level headings |
| `category` | Categories per heading, plus the listing checkpoint |
| `product` | Product tiles — `source_id`/`source_url` unique for deduplication |
| `product_detail` | Description, specs (JSONB), rating fields |
| `review` | Present for schema completeness; unpopulated (see above) |
| `scrape_job` | Job lifecycle, status and error log |
| `view_history` | Client browsing history |

---

## Testing

```bash
cd backend  && npx tsc --noEmit && npm test
cd frontend && npx tsc --noEmit && npm test && npm run build
```

`backend/scraper-smoke.ts` exercises each scraper against the live site with no database or Nest
container — useful when the site's markup drifts:

```bash
cd backend
npx ts-node scraper-smoke.ts nav      # navigation + categories
npx ts-node scraper-smoke.ts cat      # listing + checkpoint resume
npx ts-node scraper-smoke.ts detail   # detail + related products
```

---

## Known gaps

Tracked honestly rather than implied complete:

- **No `backend/Dockerfile`**, so the compose `backend` service cannot build.
- **Minimal automated tests** — one backend spec; no frontend specs yet.
- **No CI pipeline** and **no OpenAPI/Swagger** documentation.
- **No seed script**, so a reviewer currently depends on live scraping.
- **Not deployed** — no hosted frontend or backend URL yet.
