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

On first boot the backend scrapes navigation automatically if the `navigation` table is empty. If
you would rather not depend on live scraping, seed the database instead:

```bash
cd backend
npm run seed
```

See [Seed data](#seed-data) for what that loads.

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

Base URL `http://localhost:3001`. Interactive documentation is served at
**`http://localhost:3001/api/docs`** (Swagger UI), with the raw document at `/api/docs-json`.

A generated snapshot is committed at [`docs/openapi.json`](docs/openapi.json) so the contract is
readable and diffable without running anything. Regenerate it after changing a route:

```bash
cd backend && npm run openapi:export
```

| Method | Endpoint | Query | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | | Liveness + database connectivity |
| `GET` | `/api/navigation` | | Navigation headings with their categories |
| `GET` | `/api/categories` | `navigation` | All categories, optionally one heading's |
| `GET` | `/api/categories/:slug` | | One category |
| `GET` | `/api/categories/:slug/products` | `page`, `limit` | Products in a category |
| `GET` | `/api/products` | `category`, `page`, `limit` | Paged product listing |
| `GET` | `/api/products/:sourceId` | `refresh` | Product with detail, scraping on demand |
| `POST` | `/api/scrape/navigation` | | Re-scrape navigation |
| `POST` | `/api/scrape/category/:slug` | `page`, `limit` | Queue a listing scrape (returns immediately) |
| `POST` | `/api/scrape/product/:sourceId` | | Queue a detail scrape; body `{ "refresh": bool }` |
| `GET` | `/api/jobs/:id` | | Scrape job status |
| `POST` | `/api/cleanup` | | Drop stale rows |
| `POST` | `/api/cache/clear` | | Drop cached responses |

Real-time scrape progress is pushed over Socket.IO on the `/api/ws` namespace.

### Validation and error handling

Every path parameter, query string and request body is bound to a `class-validator` DTO, checked
by a global `ValidationPipe` configured with `whitelist`, `forbidNonWhitelisted` and `transform`.
Unknown properties are rejected rather than silently ignored, so a typo'd parameter is an error
instead of a surprise.

```
GET /api/products?limit=9999   → 400  ["limit may not exceed 100"]
GET /api/products?bogus=1      → 400  ["property bogus should not exist"]
GET /api/jobs/notanumber       → 400  ["id must be an integer"]
GET /api/categories/nope       → 404  Category not found: nope
```

Listing endpoints are paged (`page` ≥ 1, `limit` 1–100, default 24) and return
`{ products, total, page, limit, hasMore }`. Paged responses are cached per page, so requesting
page 2 cannot be served page 1's rows.

Requests that fail for a client-side reason answer `400` or `404`; only genuine server faults
become a `500`, and their detail goes to the log rather than the response body.

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

### Seed data

Scraping can fail during a review — the site changes markup, a network blocks the request, or
Playwright's browser is missing. `backend/database/seed-data.json` is a fallback so the app can
still be exercised end to end.

```bash
cd backend
npm run seed              # upsert the fixture; safe to re-run
npm run seed -- --reset   # clear seeded tables first, then load
```

It loads the full drilldown — navigation → categories → products → product detail — so every page
in the UI has something real behind it.

The fixture is **not invented data**. It was captured from the live site and is regenerated by
`npx ts-node build-seed-fixture.ts`, which reads the scraped navigation tree out of the database,
pulls a listing page for a set of categories spanning every heading, and scrapes detail pages for a
sample of products. `review` stays empty and `ratings_avg` stays null, for the reason given under
[Reviews](#reviews) — the seed does not fabricate what the source does not publish.

Two quirks the fixture faithfully reproduces rather than papers over:

- The **Highlights** categories (`tiktok-uk`, `summer-reads-under-4`) come back empty. Those
  collections really do return `{"products":[]}` on the live site, so those two drilldowns are
  empty here too.
- Some **rare-book** detail pages never render the heading the detail scraper waits on, so they
  time out and carry no `product_detail` row. Their listing data is still present.

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
- **No CI pipeline.**
- **Not deployed** — no hosted frontend or backend URL yet.
