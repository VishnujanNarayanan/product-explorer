# Product Data Explorer

[![CI](https://github.com/VishnujanNarayanan/product-explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/VishnujanNarayanan/product-explorer/actions/workflows/ci.yml)

A full-stack product exploration platform for [World of Books](https://www.worldofbooks.com/en-gb).
Users drill down from navigation headings → categories → product listings → product detail, with
data fetched by live, on-demand scraping and persisted to PostgreSQL.

```
Navigation headings  →  Categories  →  Product grid  →  Product detail
   (6 headings)        (143 listings)  (paged, 24/pg)    (specs + related)
```

**Live:** [product-explorer-two.vercel.app](https://product-explorer-two.vercel.app) ·
API [product-explorer-1-i0m1.onrender.com/api/docs](https://product-explorer-1-i0m1.onrender.com/api/docs)

> The API is on a free instance that sleeps after ~15 minutes idle, so the first request after a
> quiet spell takes around 50 seconds to wake it.

Opening a category nobody has opened before scrapes it live and shows the books within a second or
two. That scrape runs in the **visitor's browser**, not on the server — see
[Scraping from the visitor's browser](#scraping-from-the-visitors-browser) for why, which is the
most interesting thing in this repository.

---

## Architecture

```
                 ┌────────────────────────────────────────────┐
   browser ──────▶  Next.js (App Router)          :3000       │───────────┐
                 │  SWR · Socket.IO · browser-side scraper    │           │
                 └───────────────┬────────────────────────────┘           │
                                 │ REST /api  +  WS /api/ws               │
                 ┌───────────────▼────────────────────────────┐           │
                 │  NestJS                        :3001       │           │
                 │                                            │           │
                 │  CoreController      navigation/categories │           │
                 │  ProductsController  paged listing         │           │
                 │      │ ValidationPipe (DTOs) on every input│           │
                 │      ▼                                     │           │
                 │  ScraperService ──enqueue──▶ BullMQ queue  │           │
                 │      │                            │        │           │
                 │      │ read-through cache         │ worker │           │
                 └──────┼────────────────────────────┼────────┘           │
                        ▼                            ▼                    │
                 ┌────────────┐            ┌───────────────────┐          │
                 │ PostgreSQL │            │ Crawlee scrapers  │          │
                 │  TypeORM   │◀──persist──│ Playwright / HTTP │          │
                 └────────────┘            └─────────┬─────────┘          │
                        ▲        ┌────────┐          │                    │
                        └──import│  Redis │◀─cache   ▼                    │
                                 └────────┘  + queue                      │
                                             World of Books /en-gb ◀──────┘
                                                                collections
                                                              /products.json
```

**Requests never block on a scrape.** A listing endpoint answers from PostgreSQL immediately and
enqueues the *next* unfetched page on BullMQ; the worker scrapes, persists, and the following
request sees more data. Redis holds both the queue and a per-page response cache.

**The rightmost path is the one that carries production.** The browser reads the collection feed
itself and posts the result back to be validated and stored, because the hosted API's address is
rate-limited by the storefront while a visitor's is not. See
[Scraping from the visitor's browser](#scraping-from-the-visitors-browser).

Key decisions and why:

| Decision | Reasoning |
| --- | --- |
| **PostgreSQL**, not a document store | The domain is inherently relational — navigation owns categories, categories own products, products own detail — and the required uniqueness maps directly onto SQL constraints used for deduplication |
| **A category is (heading, slug)**, not a slug | The menu lists the same collection under several headings — "Trending Now" under both Fiction and Non-Fiction. A globally unique slug dropped the second listing, so the sidebar showed 25 entries where the site shows 27. Each listing is now its own row with its own checkpoint, and `source_id` is unique per category so the second listing's scrape cannot move products off the first |
| **Queue the scrape, serve stored data** | Keeps request latency independent of a third-party site that takes seconds per page |
| **Checkpoint per category** (`last_page_scraped`, `is_exhausted`) | Browsing fills the catalogue progressively instead of bulk-downloading, and a finished collection stops generating traffic entirely |
| **JSON feed for listings, browser for detail** | The listing grid is client-rendered by Algolia and never resolves headless; detail pages are server-rendered ([details](#why-listings-use-the-json-feed)) |
| **Never cache an empty or failed result** | Otherwise one transient failure masquerades as a valid empty answer for the whole TTL |
| **Scrape listings in the visitor's browser** | World of Books answers the hosted API's datacentre address with `429` and a visitor's browser normally. The browser is the only thing in the system that can reach the storefront from production ([details](#scraping-from-the-visitors-browser)) |
| **Validate imported rows, never trust them** | The server cannot verify a browser-scraped row by re-fetching — that is the thing it is blocked from doing — so `ImportedProductDto` refuses everything it still can: foreign hosts, non-Shopify ids, implausible prices, oversized batches |
| **Redis is optional at request time** | Cache and queue are optimisations. Both are bounded and non-fatal, so an unreachable Redis degrades to reading PostgreSQL rather than failing a request for data already stored |

---

## Stack

**Backend** — NestJS, TypeScript, PostgreSQL (TypeORM), Redis, BullMQ, Crawlee, Playwright, Socket.IO
**Frontend** — Next.js (App Router), React, TypeScript, Tailwind CSS, SWR, Socket.IO client

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 | ships with npm |
| Docker + Docker Compose | any recent | runs PostgreSQL and Redis |
| Playwright Chromium | matched to `playwright` | installed via a command below |

---

## Quick start

### Everything in Docker

```bash
git clone <repository-url>
cd product-explorer
docker compose up -d --build
```

That brings up PostgreSQL, Redis, the backend and the frontend. No Node toolchain and no
`playwright install` needed — the backend image ships Chromium and its system libraries.

| | |
| --- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| API docs | http://localhost:3001/api/docs |

Load the fallback data once the stack is healthy:

```bash
docker compose exec backend node dist/database/seed.js
```

### Running locally instead

```bash
# 1. Environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# 2. Backing services only
docker compose up -d postgres redis

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
That scrape is best-effort: if it fails the failure is logged and the API still starts, serving
whatever is stored. Set `SCRAPE_ON_STARTUP=false` to skip it entirely.

If you would rather not depend on live scraping, seed the database instead:

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

**Connections take either shape.** Managed hosts hand out either a single URL (Neon, Supabase,
Upstash, Railway) or discrete host/port/password fields (Render's private networking,
docker-compose). Both are accepted, URL first:

| | URL form | Discrete form |
| --- | --- | --- |
| PostgreSQL | `DATABASE_URL` | `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_DATABASE` |
| Redis | `REDIS_URL` | `REDIS_HOST` `REDIS_PORT` `REDIS_USERNAME` `REDIS_PASSWORD` |

TLS follows the hostname — on for a qualified name like `ep-x.aws.neon.tech`, off for a bare one
like `localhost`, a compose service or a Render internal host — which is what each actually
requires. `DB_SSL` and `REDIS_TLS` override it, and `DB_SSL_REJECT_UNAUTHORIZED=true` demands a
verified chain where the provider has one.

**Watching a scrape.** `HEADLESS=false` launches a real Chromium window instead of a headless one,
with `BROWSER_WINDOW_POSITION` and `BROWSER_WINDOW_SIZE` to place it. A headless timeout looks the
same whether a selector moved or the network failed, and seeing the page tells you which. It is
also the only way to watch the interactive scraper drive the site — it needs more memory than a
free host provides, so it can only ever run locally.

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
| `GET` | `/api/categories/:slug` | `navigation` | One category |
| `GET` | `/api/categories/:slug/products` | `navigation`, `page`, `limit` | Products in a category |
| `GET` | `/api/products` | `category`, `random`, `page`, `limit` | Paged product listing, read from storage only. `random=true` samples books that have a cover — what the home shelf shows |
| `GET` | `/api/products/:sourceId` | `refresh` | Product with detail, scraping on demand |
| `POST` | `/api/scrape/navigation` | | Re-scrape navigation |
| `POST` | `/api/scrape/category/:slug` | `navigation`, `page`, `limit` | Scrape a listing. Body `{ "refresh": true }` fetches the next page during the request; without it, returns stored data and queues a job |
| `POST` | `/api/categories/:slug/import` | `navigation` | Store products a visitor's browser scraped. Body `{ products: [...], page }`, every row validated against the shape and hosts a genuine feed entry has ([why](#scraping-from-the-visitors-browser)) |
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
| Product listings *(production)* | **the visitor's browser** | the same feed, read client-side |
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

### Scraping from the visitor's browser

The deployed API cannot scrape at all. World of Books answers its datacentre address with `429` on
every request, three retries deep, for every collection:

```
WARN  HttpCrawler: Request blocked - received 429 status code (retry 1, 2, 3)
ERROR [CategoryScraper] Listing request failed: 429
```

The same URL returns `200` from a residential connection. The storefront is not blocking the
scraper; it is blocking where the scraper runs. No amount of queue, memory or patience changes
that.

A visitor's browser is not blocked — and the feed is served with `access-control-allow-origin: *`,
which is a site stating that any page may read it. So in production the fetch happens there:

```
visitor clicks a category
  → their browser reads /collections/<slug>/products.json      (their IP, their RAM)
  → books render, ~1s, visible in their own network tab
  → rows are POSTed to /api/categories/<slug>/import
  → server validates every field, stores what survives
  → the next visitor gets them from PostgreSQL in ~200ms
```

Scraping load then scales with the number of people looking, rather than contending for one small
instance.

**Storing what a browser sends is a real decision, not a shortcut.** The server cannot verify these
rows by re-fetching, since that is precisely what it is blocked from doing. So
[`ImportedProductDto`](backend/src/modules/core/dto/index.ts) refuses everything it still can — URLs
that do not point at `worldofbooks.com` and Shopify's CDN, ids that are not Shopify ids, prices no
used book carries, batches larger than a feed page, and any field the feed has no equivalent of.
A caller can still post a plausible book that does not exist; that is inherent in accepting client
data, and it is why the browser is trusted only to relay a public feed and never to assert anything
else. The refusals are covered by
[`import-validation.spec.ts`](backend/src/modules/core/dto/import-validation.spec.ts).

The client's parser deliberately mirrors the server's — same author-from-handle rule, same
lowest-in-stock-variant price rule — so a row fetched by a browser and one fetched by the server
describe the same book identically.

**Backing off.** A `429` is aimed at the address, not the collection, so a refusal holds every
collection back for ten minutes rather than being retried on the next page load. Without that, one
category was refused three times in thirty seconds — how a temporary block earns a permanent one.
An ordinary failure stays scoped to the collection that failed.

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
| `category` | Categories per heading, plus the listing checkpoint — unique on `(navigation_id, slug)` |
| `product` | Product tiles — unique on `(category_id, source_id)`, so a collection listed under two headings fills both |
| `product_detail` | Description, specs (JSONB), rating fields |
| `review` | Present for schema completeness; unpopulated (see above) |
| `scrape_job` | Job lifecycle, status and error log |
| `view_history` | Client browsing history |

The init hook only runs when the Postgres volume is first created. A database created
before categories were keyed by `(navigation_id, slug)` is migrated by applying the same
file to it — the constraint changes in it are written to be idempotent:

```bash
docker exec -i product-explorer-postgres-1 \
  psql -U admin -d wob_explorer < backend/database/schema.sql
curl -X POST http://localhost:3001/api/scrape/navigation   # pick up the extra listings
```

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

## Docker

`docker compose up -d --build` builds and runs the whole stack. Both images are multi-stage, so
build tooling never reaches the runtime layer, and both run as a non-root user.

| Image | Base | Size | Notes |
| --- | --- | --- | --- |
| `backend` | `mcr.microsoft.com/playwright:v1.57.0-jammy` | ~3.5 GB | Carries Chromium and its system libraries |
| `frontend` | `node:22-alpine` | ~331 MB | Next.js `output: 'standalone'` |

The backend uses Microsoft's Playwright image rather than a plain Node base. The scrapers drive a
real browser, and a browser build that does not match the `playwright` package fails at launch
with a misleading "install dependencies" error — so the image pins the pair together. Keep the
`PLAYWRIGHT_VERSION` build arg in step with the `playwright` dependency in `package.json`.

`NEXT_PUBLIC_*` values are compiled into the client bundle, so the frontend takes them as **build
args**, not runtime environment. They point at the published host ports because the browser
resolves them, not the compose network.

The backend image declares a healthcheck against `/api/health`, and `frontend` waits on it.

---

## Testing and CI

```bash
cd backend  && npm run lint && npx tsc --noEmit && npm test && npm run test:e2e
cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build
```

**176 tests**, none of which touch the network:

| Suite | Count | Covers |
| --- | --- | --- |
| `base.scraper.spec.ts` | 23 | Locale-prefixed URL building, the handle→author parse, price and HTML normalisation |
| `dto-validation.spec.ts` | 47 | Every request DTO, against real slugs and source ids |
| `core.controller.spec.ts` | 25 | Routing, 404 vs 500, paging pass-through, the legacy route |
| `startup-scrape.spec.ts` | 5 | Boot-time scrape is best-effort and cannot block startup |
| `products.service.spec.ts` | 12 | Paging arithmetic and `hasMore` boundaries |
| `api.e2e-spec.ts` | 22 | **Integration** — the real app against real PostgreSQL and Redis |
| frontend | 42 | `useSearch` debounce, `ProductCard` rendering and a11y, shared utilities |

The integration suite inserts its own `e2e-`-prefixed fixture, marks its category exhausted so
no request can reach World of Books, and removes the fixture afterwards. One of its tests walks
every entity's columns against the live schema — the check that would have caught the
`result_count` drift.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request to
`main`, in three parallel jobs:

| Job | Does |
| --- | --- |
| **backend** | lint → typecheck → unit tests → integration tests → build → seed smoke test |
| **frontend** | lint → typecheck → test → build |
| **docker** | builds both images, with layer caching |

The backend job runs against real PostgreSQL and Redis service containers rather than mocks, and
applies `schema.sql` explicitly — so a schema that drifts from the entities fails the build. It
finishes by running the seed, which proves the fallback fixture still loads against the current
schema.

`backend/scraper-smoke.ts` exercises each scraper against the live site with no database or Nest
container — useful when the site's markup drifts:

```bash
cd backend
npx ts-node scraper-smoke.ts nav      # navigation + categories
npx ts-node scraper-smoke.ts cat      # listing + checkpoint resume
npx ts-node scraper-smoke.ts detail   # detail + related products
```

---

## Deployment

Running on free tiers throughout:

| Piece | Host | Notes |
| --- | --- | --- |
| Frontend | **Vercel**, root directory `frontend` | [product-explorer-two.vercel.app](https://product-explorer-two.vercel.app) |
| Backend | **Render**, Docker, root directory `backend` | 512 MB, sleeps after ~15 min idle |
| PostgreSQL | **Neon** | Render's own free Postgres expires after 30 days |
| Redis | **Render Key Value** | cache and queue |

The backend needs PostgreSQL, Redis, and roughly 2 GB of image space for Chromium — so it wants a
container host rather than a serverless function platform. The frontend is a standard Next.js app
and suits Vercel.

**Backend** — deploy `backend/Dockerfile`, provision managed PostgreSQL and Redis, and set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the managed database, or the discrete `DB_*` fields |
| `REDIS_URL` | the managed Redis, or the discrete `REDIS_*` fields |
| `PORT` | whatever the platform injects |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | the deployed frontend origin — this is the CORS allowlist. It must match **exactly**, and the WebSocket gateway takes a single value, so no comma-separated list if you want live progress |
| `SCRAPE_ON_STARTUP` | `false` if you intend to seed rather than scrape on boot |

`NODE_ENV=production` disables TypeORM `synchronize`, so the schema comes solely from
`backend/database/schema.sql`. Apply it once against the fresh database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/database/schema.sql
```

Then load the fallback data so the site is not empty on first visit:

```bash
npm run seed:prod      # runs dist/database/seed.js inside the deployed container
```

**Frontend** — deploy `frontend/`, or `frontend/Dockerfile` if the platform prefers a container.
`NEXT_PUBLIC_*` values are compiled into the client bundle, so they must be set as **build-time**
variables and the app **rebuilt** if they change:

```
NEXT_PUBLIC_API_URL=https://<backend-host>
NEXT_PUBLIC_WS_URL=wss://<backend-host>/api/ws
NEXT_PUBLIC_APP_URL=https://<frontend-host>
```

Things that will bite otherwise, each learned the hard way here:

- **`FRONTEND_URL` must match the origin the browser actually sends.** Vercel serves the same build
  on several hostnames — the production domain and a per-deployment one — and only the one in the
  address bar counts. A mismatch shows no `access-control-allow-origin` header at all while the
  preflight still returns `204`, which reads like the endpoint is fine.
- **`NEXT_PUBLIC_WS_URL` must end in `/api/ws`.** The gateway declares that namespace and Socket.IO
  reads the URL path as the namespace, so a bare host connects to `/` and is refused.
- **`NEXT_PUBLIC_*` are baked in at build time.** Changing one requires a redeploy, not a restart.
- **`GET /api/health` reports PostgreSQL only.** It says nothing about Redis, so it can read `OK`
  while the cache and queue are both unreachable.
- **A monorepo host skips deploys outside its root directory.** A frontend-only commit correctly
  does not rebuild a backend whose root is `backend/`.

Verify a deployment with `GET /api/health` and `/api/docs`.

---

## Known gaps

Tracked honestly rather than implied complete:

- **Three `react-hooks/set-state-in-effect` warnings.** `WebSocketStatus` and
  `useInteractiveScraper` mirror the Socket.IO client into React state, where
  `useSyncExternalStore` is the right tool, and `useSearch` flips a flag inside its debounce
  timer. Real findings, deliberately left as warnings rather than rewritten blind — that
  refactor wants test coverage behind it first.
- **The interactive scraper cannot run on the deployment.** It drives a real browser through
  hover → click → scrape, and Chromium will not start in 512 MB. The live session still connects,
  and a failed attempt now hands over to the browser-side scrape rather than dead-ending, but the
  feature itself is only visible locally — run the backend with `HEADLESS=false` to watch it.
- **The BullMQ queue's Redis connection does not establish in production.** Nothing on the visitor
  path depends on it: cache and queue operations are bounded and fall through to PostgreSQL. The
  cost is that background refreshes never run.
- **`category.product_count` reads 0 for seeded rows.** Only a scrape populates it, and the seed
  fixture does not. Cosmetic — the products are there and the grid shows them.
- **Imported rows are trusted to be a faithful relay of a public feed.** Validation refuses
  anything structurally wrong or pointed at another host, but a determined caller could still post
  a plausible book that does not exist. Unavoidable while the server cannot re-fetch to verify;
  the honest fix is an origin that World of Books will answer.
