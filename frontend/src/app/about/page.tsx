import Link from "next/link"

/**
 * A technical note, not a brochure. Everything here is a decision that is actually in the
 * code, with the reason it was made — the previous version described "millions of books"
 * and a "microservices-inspired architecture", neither of which was true.
 */

// A request really is a sequence, which is the only reason it is numbered.
const requestPath = [
  {
    step: 'You open a category',
    detail:
      'The live browser session hovers the section in the mega-menu and clicks the category, the same way a person reaches it.',
  },
  {
    step: 'Stored books paint immediately',
    detail:
      'The API answers from PostgreSQL rather than waiting on the scrape, so the grid is never blank while the session works.',
  },
  {
    step: 'The next unfetched page is queued',
    detail:
      'BullMQ takes the job; the worker scrapes, deduplicates on (category, source_id) and persists. Latency stays independent of a third-party site that takes seconds per page.',
  },
  {
    step: 'Results arrive over the socket',
    detail:
      'Books stream in as DATA_CHUNK messages and the page fills in. The bar above reports "Scraping live" only while that is happening.',
  },
]

const decisions = [
  {
    decision: 'A category is (heading, slug), not a slug',
    reason:
      'World of Books lists the same collection under several headings — "Trending Now" sits under both Fiction and Non-Fiction. Keying on the slug alone dropped the second listing, showing 25 categories where the site shows 27. Each listing is its own row with its own checkpoint, and source_id is unique per category so one listing\'s scrape cannot move books off another.',
  },
  {
    decision: 'Listings read the JSON feed; menus and detail pages use a browser',
    reason:
      'Category grids are rendered client-side by Algolia InstantSearch and never resolve past the skeleton loader in a headless browser, so DOM scraping returns nothing whatever the selector. Shopify publishes the same catalogue as JSON, which robots.txt permits. It is still fetched through Crawlee, so queueing, retries and backoff are identical to the browser-driven tiers.',
  },
  {
    decision: 'Checkpoint per category (last_page_scraped, is_exhausted)',
    reason:
      'Browsing fills the catalogue progressively instead of bulk-downloading it, and a collection that has been read to the end stops generating traffic entirely.',
  },
  {
    decision: 'Never cache an empty or failed result',
    reason:
      'Otherwise one transient failure masquerades as a valid empty answer for the whole hour the entry lives.',
  },
  {
    decision: 'No ratings, no reviews',
    reason:
      'World of Books publishes neither, so ratings_avg is always null and no star row is rendered. Inventing them would be showing fabricated data.',
  },
]

const stack = [
  {
    area: 'Backend',
    items: 'NestJS · TypeScript · PostgreSQL (TypeORM) · Redis · BullMQ · Crawlee · Playwright · Socket.IO',
  },
  {
    area: 'Frontend',
    items: 'Next.js (App Router) · React · TypeScript · Tailwind CSS · SWR · Socket.IO client',
  },
  {
    area: 'Scraping tiers',
    items:
      'Navigation and categories via Playwright · listings via HttpCrawler on products.json · detail via Playwright on JSON-LD',
  },
]

export default function AboutPage() {
  return (
    <div className="container max-w-4xl space-y-14 py-12">
      <header className="border-b pb-8">
        <p className="label-meta">Technical note</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          How this thing works
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          A catalogue explorer for World of Books. It holds no inventory of its own: every
          section, category and book on the site was read from worldofbooks.com on demand and
          kept, so the second visit costs the origin nothing.
        </p>
      </header>

      <section>
        <h2 className="font-display text-2xl font-semibold">What happens when you click</h2>
        <ol className="mt-6 divide-y divide-border border-y border-border">
          {requestPath.map((entry, index) => (
            <li key={entry.step} className="flex gap-5 py-5">
              <span className="font-mono text-sm text-highlight">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{entry.step}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {entry.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Decisions worth defending</h2>
        <dl className="mt-6 divide-y divide-border border-y border-border">
          {decisions.map((entry) => (
            <div key={entry.decision} className="py-5">
              <dt className="font-medium">{entry.decision}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {entry.reason}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Built with</h2>
        <dl className="mt-6 divide-y divide-border border-y border-border">
          {stack.map((entry) => (
            <div key={entry.area} className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]">
              <dt className="label-meta pt-1">{entry.area}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{entry.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-dashed p-6">
        <h2 className="font-display text-xl font-semibold">On scraping politely</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Requests are queued rather than parallelised, retried with backoff through Crawlee,
          and stopped altogether once a collection is exhausted. Listings come from a JSON
          endpoint robots.txt allows. This is a demonstration project, not a commercial
          mirror — the catalogue it shows belongs to World of Books.
        </p>
        <Link
          href="/readme"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Full documentation
        </Link>
      </section>
    </div>
  )
}
