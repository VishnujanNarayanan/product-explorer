<h1 align="center">Product Data Explorer</h1>

<p align="center">
  Browse the <a href="https://www.worldofbooks.com/en-gb">World of Books</a> catalogue —<br>
  headings, categories, books and their details, gathered live from the site itself.
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
  📖 <a href="#overview">Overview</a> ·
  🌐 <a href="#try-it">Try it</a> ·
  ✨ <a href="#what-it-does">What it does</a> ·
  ⚙️ <a href="#how-it-works">How it works</a> ·
  ⚡ <a href="#run-it-locally">Run it locally</a> ·
  🔌 <a href="#api">API</a> ·
  🧪 <a href="#tests">Tests</a> ·
  📁 <a href="#project-structure">Project structure</a>
</p>

---

## Overview

[World of Books](https://www.worldofbooks.com/en-gb) is a UK retailer selling several million
second-hand books, films and music. Its catalogue is organised the way a bookshop is — broad
headings like *Fiction* or *Children's Books*, each holding dozens of categories, each holding
books.

This project rebuilds that catalogue as a browsable app, and gathers it category by category from
the live site. Nothing is downloaded in advance: the first person to open *Crime & Mystery* causes
it to be fetched from World of Books right then, and it is stored so everyone after them sees it
immediately. Opening a book fetches its description and specifications the same way.

It is a full-stack demonstration — a Next.js front end, a NestJS API, PostgreSQL, Redis, and
scrapers built on Playwright and Crawlee — of doing that politely and reliably against a real site
that was not built to be read this way.

## Try it

**[product-explorer-two.vercel.app](https://product-explorer-two.vercel.app)**

Pick a heading, choose a category, open a book. Categories nobody has opened yet are fetched from
World of Books while you wait — usually a second or two — and are instant from then on.

> Hosted on free tiers, so the very first request may take up to a minute while the server wakes.

## What it does

| | |
| --- | --- |
| **Browse the catalogue** | 6 headings → 113 categories → books → detail pages, mirroring how the real site is organised |
| **Fetch on demand** | An empty category is filled the moment someone opens it, rather than the whole site being downloaded up front |
| **Remember what it found** | Everything fetched is stored, so the next visitor gets it immediately |
| **Keep going** | *Load more* pulls the next page of a collection |
| **Search and history** | Find books by title or author; recently viewed pages are kept |
| **Link out** | Every book links to its page on World of Books |

## How it works

Three parts: a **Next.js** front end, a **NestJS** API, and **PostgreSQL** for storage, with
**Redis** caching responses and holding a background job queue.

The catalogue is gathered from World of Books in two ways. Menus and product detail pages are read
with a real browser through **Playwright**, because that is how they are rendered. Product listings
come from the storefront's public JSON feed, which is faster and lighter than driving a browser.

One detail worth knowing, because it explains what you see: **listings are fetched by your own
browser**, not by the server. The site allows this — the feed is published for public use — and it
keeps the hosted app responsive no matter how many people are browsing. The results are sent to the
API, which checks each one before storing it.

```
you click a category
     ↓
your browser fetches the listing from World of Books      ~1s
     ↓
books appear, and are sent to the API to be stored
     ↓
anyone opening that category later gets it instantly
```

## Run it locally

**Prerequisites** — Node.js 20+, Docker, and about 2 GB free for the Chromium download.

### Everything in Docker

```bash
git clone https://github.com/VishnujanNarayanan/product-explorer.git
cd product-explorer
cp .env.example .env
docker compose up --build
```

Front end on **http://localhost:3000**, API on **http://localhost:3001**.

### Or run the apps directly

```bash
cp .env.example .env
docker compose up -d postgres redis        # just the databases

# API — first terminal
cd backend
npm install
npx playwright install chromium
npm run seed                               # loads a set of real books to start from
npm run start:dev

# Front end — second terminal
cd frontend
npm install
npm run dev
```

Settings live in [`.env.example`](.env.example), which is commented throughout. The defaults match
the Docker services, so it works unchanged.

**Want to watch it scrape?** Start the API with `HEADLESS=false` and a Chromium window opens,
navigating World of Books as it works.

## API

Interactive documentation at **http://localhost:3001/api/docs**.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/navigation` | Headings with their categories |
| `GET` | `/api/categories/:slug/products` | Books in a category, fetching them if it has none |
| `GET` | `/api/products` | All books, paged |
| `GET` | `/api/products/:sourceId` | One book with its details |
| `POST` | `/api/scrape/category/:slug` | Fetch another page of a category |
| `POST` | `/api/categories/:slug/import` | Store books fetched by a browser |
| `GET` | `/api/health` | Service status |

## Tests

```bash
cd backend  && npm test        # 153 tests
cd frontend && npm test        # 81 tests
```

Covering the scrapers, the API's validation rules, what happens when Redis or World of Books is
unreachable, and the front-end components. CI runs lint, type checking, tests and a production
build on every push.

## Project structure

```
backend/          NestJS API
  src/modules/    scraper, catalogue and product endpoints
  src/entities/   database tables
  database/       schema and seed data
frontend/         Next.js app
  src/app/        pages
  src/components/ UI
  src/lib/        API client, hooks, browser-side scraper
docs/             OpenAPI snapshot
```

## Notes

- Scraping is deliberately gentle: the site's `robots.txt` is respected, requests are spaced three
  seconds apart, and a category stops being re-fetched once it is complete.
- World of Books publishes no ratings or reviews, so the app shows none rather than inventing them.
- The hosted demo sleeps when idle and has limited memory, so the browser-driven scraper only runs
  when you run the project yourself.

## Author

<p align="center">
  <strong>Vishnujan Narayanan</strong>
</p>

<p align="center">
  <a href="https://github.com/VishnujanNarayanan"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-VishnujanNarayanan-181717?logo=github&logoColor=white&style=for-the-badge"/></a>
  <a href="https://www.linkedin.com/in/vishnujan-narayanan"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-Vishnujan_Narayanan-0A66C2?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0yMC40NDcgMjAuNDUyaC0zLjU1NHYtNS41NjljMC0xLjMyOC0uMDI3LTMuMDM3LTEuODUyLTMuMDM3LTEuODUzIDAtMi4xMzYgMS40NDUtMi4xMzYgMi45Mzl2NS42NjdIOS4zNTFWOWgzLjQxNHYxLjU2MWguMDQ2Yy40NzctLjkgMS42MzctMS44NSAzLjM3LTEuODUgMy42MDEgMCA0LjI2NyAyLjM3IDQuMjY3IDUuNDU1djYuMjg2ek01LjMzNyA3LjQzM2MtMS4xNDQgMC0yLjA2My0uOTI2LTIuMDYzLTIuMDY1IDAtMS4xMzguOTItMi4wNjMgMi4wNjMtMi4wNjMgMS4xNCAwIDIuMDY0LjkyNSAyLjA2NCAyLjA2MyAwIDEuMTM5LS45MjUgMi4wNjUtMi4wNjQgMi4wNjV6bTEuNzgyIDEzLjAxOUgzLjU1NVY5aDMuNTY0djExLjQ1MnpNMjIuMjI1IDBIMS43NzFDLjc5MiAwIDAgLjc3NCAwIDEuNzI5djIwLjU0MkMwIDIzLjIyNy43OTIgMjQgMS43NzEgMjRoMjAuNDUxQzIzLjIgMjQgMjQgMjMuMjI3IDI0IDIyLjI3MVYxLjcyOUMyNCAuNzc0IDIzLjIgMCAyMi4yMjIgMGguMDAzeiIvPjwvc3ZnPg%3D%3D&logoColor=white&style=for-the-badge"/></a>
  <a href="https://substack.com/@vishnujannarayanan"><img alt="Substack" src="https://img.shields.io/badge/Substack-@vishnujannarayanan-FF6719?logo=substack&logoColor=white&style=for-the-badge"/></a>
</p>
