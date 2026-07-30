<h1 align="center">Product Data Explorer</h1>

<p align="center">
  A full-stack catalogue for <a href="https://www.worldofbooks.com/en-gb">World of Books</a> —<br>
  navigation → categories → products → detail, filled by <b>live scraping that runs in the
  visitor's browser</b> because the server's address is the one being blocked.
</p>

<div align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white">
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-Crawlee-2EAD33?logo=playwright&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-234_passing-success">
  <br>
  <a href="https://github.com/VishnujanNarayanan"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-VishnujanNarayanan-181717?logo=github&logoColor=white&style=for-the-badge"/></a>
  <a href="https://www.linkedin.com/in/vishnujan-narayanan"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-Vishnujan_Narayanan-0A66C2?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0yMC40NDcgMjAuNDUyaC0zLjU1NHYtNS41NjljMC0xLjMyOC0uMDI3LTMuMDM3LTEuODUyLTMuMDM3LTEuODUzIDAtMi4xMzYgMS40NDUtMi4xMzYgMi45Mzl2NS42NjdIOS4zNTFWOWgzLjQxNHYxLjU2MWguMDQ2Yy40NzctLjkgMS42MzctMS44NSAzLjM3LTEuODUgMy42MDEgMCA0LjI2NyAyLjM3IDQuMjY3IDUuNDU1djYuMjg2ek01LjMzNyA3LjQzM2MtMS4xNDQgMC0yLjA2My0uOTI2LTIuMDYzLTIuMDY1IDAtMS4xMzguOTItMi4wNjMgMi4wNjMtMi4wNjMgMS4xNCAwIDIuMDY0LjkyNSAyLjA2NCAyLjA2MyAwIDEuMTM5LS45MjUgMi4wNjUtMi4wNjQgMi4wNjV6bTEuNzgyIDEzLjAxOUgzLjU1NVY5aDMuNTY0djExLjQ1MnpNMjIuMjI1IDBIMS43NzFDLjc5MiAwIDAgLjc3NCAwIDEuNzI5djIwLjU0MkMwIDIzLjIyNy43OTIgMjQgMS43NzEgMjRoMjAuNDUxQzIzLjIgMjQgMjQgMjMuMjI3IDI0IDIyLjI3MVYxLjcyOUMyNCAuNzc0IDIzLjIgMCAyMi4yMjIgMGguMDAzeiIvPjwvc3ZnPg%3D%3D&logoColor=white&style=for-the-badge"/></a>
  <a href="https://substack.com/@vishnujannarayanan"><img alt="Substack" src="https://img.shields.io/badge/Substack-@vishnujannarayanan-FF6719?logo=substack&logoColor=white&style=for-the-badge"/></a>
</div>

<p align="center">
  🌐 <a href="#live">Live</a> ·
  🔍 <a href="#the-interesting-part">The interesting part</a> ·
  🧭 <a href="#architecture">Architecture</a> ·
  ⚡ <a href="#quick-start">Quick start</a> ·
  🔌 <a href="#api">API</a> ·
  🕷️ <a href="#scraping-design">Scraping design</a> ·
  🧪 <a href="#testing">Testing</a> ·
  🚀 <a href="#deployment">Deployment</a> ·
  🕳️ <a href="#known-gaps">Known gaps</a>
</p>

---

## Live

| | |
| --- | --- |
| **App** | [product-explorer-two.vercel.app](https://product-explorer-two.vercel.app) |
| **API docs** | [/api/docs](https://product-explorer-1-i0m1.onrender.com/api/docs) — Swagger UI |

> The API runs on a free instance that sleeps after ~15 minutes idle. The first request after a
> quiet spell takes about 50 seconds to wake it.

Open a category nobody has opened before and it fills in about a second, scraped live. Open it
again and it comes back in ~200 ms from PostgreSQL.

## The interesting part

**World of Books blocks the server, not the scraper.** Every request from the hosted API is
refused, three retries deep, for every collection:

```
WARN  HttpCrawler: Request blocked - received 429 status code (retry 1, 2, 3)
ERROR [CategoryScraper] Listing request failed: 429
```

The same URL returns `200` from a residential connection. No amount of queue, memory or patience
changes that — it is the address being refused.

A visitor's browser is not refused, and the storefront serves its collection feed with
`access-control-allow-origin: *`, which is a site stating that any page may read it. So in
production the fetch happens there:

```
visitor clicks a category
  → their browser reads /collections/<slug>/products.json     their IP, their RAM
  → books render, ~1s, visible in their own network tab
  → rows POST to /api/categories/<slug>/import
  → server validates every field, stores what survives
  → next visitor gets them from PostgreSQL in ~200ms
```

Scraping then scales with the number of people looking, instead of contending for one instance.

**The rows are validated, never trusted.** The server cannot verify them by re-fetching — that is
exactly what it is blocked from doing — so
[`ImportedProductDto`](backend/src/modules/core/dto/index.ts) refuses everything it still can:

| Rejected | Because |
| --- | --- |
| URLs outside `worldofbooks.com` and `cdn.shopify.com` | A row may not point the catalogue at another host |
| Ids that are not Shopify numeric ids | Nothing else can have come from the feed |
| Prices outside £0–£1000, currencies other than GBP | The `/en-gb` storefront quotes neither |
| Batches over 250, empty batches, unknown fields | A feed page is 250 at most |

A caller could still post a plausible book that does not exist. That is inherent in accepting
client data, and it is why the browser is trusted only to relay a public feed and never to assert
anything else.

## Architecture

```
   browser ─── Next.js (App Router) ────────────────────────┐  reads the
                    │  REST /api  ·  WS /api/ws             │  collection
                    ▼                                       │  feed itself
               NestJS  ── ValidationPipe on every input      │
                    │                                       │
        ┌───────────┼───────────┐                           │
        ▼           ▼           ▼                           │
   PostgreSQL    Redis      Crawlee scrapers                 │
    (TypeORM)  cache+queue  Playwright / HTTP ──────────────▶│
                                                   World of Books /en-gb
```

Requests never block on a scrape: a listing endpoint answers from PostgreSQL and enqueues the
*next* unfetched page. Redis holds the queue and a per-page response cache — both bounded and
non-fatal, so losing Redis degrades to reading PostgreSQL rather than failing.

| Decision | Reasoning |
| --- | --- |
| **PostgreSQL**, not a document store | The domain is relational and the uniqueness rules map onto SQL constraints |
| **A category is (heading, slug)** | The menu lists the same collection under several headings; a globally unique slug silently dropped the second |
| **Checkpoint per category** | Browsing fills the catalogue progressively; a finished collection stops generating traffic entirely |
| **JSON feed for listings, browser for detail** | The listing grid is client-rendered by Algolia and never resolves headless |
| **Never cache an empty result** | One transient failure would otherwise masquerade as a valid empty answer for the whole TTL |

## Quick start

```bash
cp .env.example .env
docker compose up --build        # app on :3000, API on :3001
```

Or run the pieces directly:

```bash
docker compose up -d postgres redis          # backing services only

cd backend  && npm install && npx playwright install chromium
npm run seed && npm run start:dev            # :3001

cd frontend && npm install && npm run dev    # :3000
```

`HEADLESS=false` launches a real Chromium window instead of a headless one — the only way to watch
the interactive scraper drive the site, since it needs more memory than a free host provides.

## API

Swagger UI at `/api/docs`; a committed snapshot lives at [`docs/openapi.json`](docs/openapi.json).

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + database connectivity |
| `GET` | `/api/navigation` | Headings with their categories |
| `GET` | `/api/categories/:slug/products` | Products in a category, scraping if it holds none |
| `GET` | `/api/products` | Paged listing, storage only. `random=true` samples books with covers |
| `GET` | `/api/products/:sourceId` | Product with detail, scraped on demand |
| `POST` | `/api/scrape/category/:slug` | `{ "refresh": true }` fetches the next page during the request |
| `POST` | `/api/categories/:slug/import` | Store products a visitor's browser scraped |
| `POST` | `/api/scrape/navigation` | Re-scrape the navigation tree |
| `GET` | `/api/jobs/:id` | Scrape job status |

Every parameter and body is bound to a `class-validator` DTO behind a global `ValidationPipe` with
`whitelist`, `forbidNonWhitelisted` and `transform`:

```
GET /api/products?limit=9999   → 400  ["limit may not exceed 100"]
GET /api/products?bogus=1      → 400  ["property bogus should not exist"]
GET /api/categories/nope       → 404  Category not found: nope
```

## Scraping design

| Tier | Engine | Source |
| --- | --- | --- |
| Navigation + categories | Crawlee **Playwright** | mega-menu markup on `/en-gb` |
| Listings *(production)* | **the visitor's browser** | `/collections/<slug>/products.json` |
| Listings *(server)* | Crawlee **HttpCrawler** | the same feed |
| Product detail | Crawlee **Playwright** | schema.org JSON-LD + `#info-*` table |

**Why listings use the JSON feed.** Category pages render their grid through Algolia
InstantSearch on the client. In a headless browser it never resolves past `#skeleton-loader`, so
DOM scraping of a listing returns nothing regardless of selector. Shopify publishes the same
catalogue as JSON, which `robots.txt` permits.

**Ethics.** `robots.txt` respected, 3 s between sequential requests, single concurrency, honest
User-Agent, exponential backoff. A `429` backs every collection off for ten minutes — it is the
address being refused, not the collection, and retrying per page load is how a temporary block
becomes a permanent one.

**Reviews are deliberately empty.** World of Books publishes no review or rating markup — verified
by scanning for `[class*="rating"]`, `[class*="review"]`, `[class*="star"]` and `[data-rating]`,
all matching zero elements. The `review` table exists and stays unpopulated; synthesising reviews
would put fabricated data in front of users.

## Testing

```bash
cd backend  && npm test        # 153
cd frontend && npm test        # 81
```

| Suite | Covers |
| --- | --- |
| `import-validation.spec.ts` | What the import endpoint refuses — foreign hosts, lookalike hosts, `javascript:` URLs, absurd prices, oversized batches |
| `inline-scrape.spec.ts` | Scraping when a category is empty, and the backoff after a refusal |
| `redis-outage.spec.ts` | Reads falling through to PostgreSQL when Redis is unreachable |
| `browser-scraper.spec.ts` | Feed parsing, against fixtures taken verbatim from the live site |
| `import-payload.spec.ts` | The shape of what the client sends — one undeclared field rejects a whole batch |
| `SideRail` / `Header` | Mobile disclosure behaviour |

CI runs lint, typecheck, tests and a production build on both packages.

## Deployment

Free tiers throughout:

| Piece | Host |
| --- | --- |
| Frontend | **Vercel**, root directory `frontend` |
| Backend | **Render**, Docker, root directory `backend` |
| PostgreSQL | **Neon** — Render's own free Postgres expires after 30 days |
| Redis | **Render Key Value** |

`DATABASE_URL` and `REDIS_URL` are accepted, as are the discrete `DB_*` / `REDIS_*` fields. TLS
follows the hostname: on for a qualified name, off for a bare one.

Traps worth knowing, each learned here:

- **`FRONTEND_URL` must match the origin the browser sends.** Vercel serves the same build on
  several hostnames; only the one in the address bar counts. A mismatch returns no
  `access-control-allow-origin` header while the preflight still answers `204`.
- **`NEXT_PUBLIC_WS_URL` must end in `/api/ws`** — Socket.IO reads the URL path as the namespace.
- **`NEXT_PUBLIC_*` are baked in at build time.** Changing one needs a redeploy, not a restart.
- **`/api/health` reports PostgreSQL only.** It can read `OK` while Redis is unreachable.

## Known gaps

- **The interactive scraper cannot run on the deployment.** It drives a real browser through
  hover → click → scrape, and Chromium will not start in 512 MB. A failed attempt hands over to
  the browser-side scrape rather than dead-ending. Run locally with `HEADLESS=false` to watch it.
- **The BullMQ queue's Redis connection does not establish in production.** Nothing on the visitor
  path depends on it; the cost is that background refreshes never run.
- **`category.product_count` reads 0 for seeded rows** — only a scrape populates it. Cosmetic.
- **Three `react-hooks/set-state-in-effect` warnings** where Socket.IO state is mirrored into
  React. Real findings, left as warnings rather than rewritten blind — that refactor wants test
  coverage behind it first.

## Author

<p align="center">
  <strong>Vishnujan Narayanan</strong>
</p>

<p align="center">
  <a href="https://github.com/VishnujanNarayanan"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-VishnujanNarayanan-181717?logo=github&logoColor=white&style=for-the-badge"/></a>
  <a href="https://www.linkedin.com/in/vishnujan-narayanan"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-Vishnujan_Narayanan-0A66C2?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0yMC40NDcgMjAuNDUyaC0zLjU1NHYtNS41NjljMC0xLjMyOC0uMDI3LTMuMDM3LTEuODUyLTMuMDM3LTEuODUzIDAtMi4xMzYgMS40NDUtMi4xMzYgMi45Mzl2NS42NjdIOS4zNTFWOWgzLjQxNHYxLjU2MWguMDQ2Yy40NzctLjkgMS42MzctMS44NSAzLjM3LTEuODUgMy42MDEgMCA0LjI2NyAyLjM3IDQuMjY3IDUuNDU1djYuMjg2ek01LjMzNyA3LjQzM2MtMS4xNDQgMC0yLjA2My0uOTI2LTIuMDYzLTIuMDY1IDAtMS4xMzguOTItMi4wNjMgMi4wNjMtMi4wNjMgMS4xNCAwIDIuMDY0LjkyNSAyLjA2NCAyLjA2MyAwIDEuMTM5LS45MjUgMi4wNjUtMi4wNjQgMi4wNjV6bTEuNzgyIDEzLjAxOUgzLjU1NVY5aDMuNTY0djExLjQ1MnpNMjIuMjI1IDBIMS43NzFDLjc5MiAwIDAgLjc3NCAwIDEuNzI5djIwLjU0MkMwIDIzLjIyNy43OTIgMjQgMS43NzEgMjRoMjAuNDUxQzIzLjIgMjQgMjQgMjMuMjI3IDI0IDIyLjI3MVYxLjcyOUMyNCAuNzc0IDIzLjIgMCAyMi4yMjIgMGguMDAzeiIvPjwvc3ZnPg%3D%3D&logoColor=white&style=for-the-badge"/></a>
  <a href="https://substack.com/@vishnujannarayanan"><img alt="Substack" src="https://img.shields.io/badge/Substack-@vishnujannarayanan-FF6719?logo=substack&logoColor=white&style=for-the-badge"/></a>
</p>
