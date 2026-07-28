import Link from "next/link"

/**
 * Written as prose rather than as feature cards: the point of this page is that someone
 * who has never seen the codebase can read it top to bottom and understand what the
 * product does, how a page of books gets onto the screen, and why each piece of the stack
 * is there. Every claim on it is true of the code.
 */

const steps = [
  {
    title: 'You choose a category',
    body:
      'Every section in the bar at the top of the site is a real heading from the World of Books menu, and the categories inside it are that heading\'s own. When you pick one, the application opens a real browser session on worldofbooks.com, hovers the section in the menu and clicks the category, exactly as a person would reach it.',
  },
  {
    title: 'Books that are already stored appear straight away',
    body:
      'The page does not wait for the scrape to finish. The API answers from PostgreSQL with whatever has been collected before, so you have something to read within a moment of arriving, and anything new is added to it as it arrives.',
  },
  {
    title: 'The next unread page is queued in the background',
    body:
      'Rather than downloading a whole collection at once, the application asks for the next page that has not been fetched yet and hands that job to a queue. A worker performs the scrape, discards anything already held, and saves the rest. Because the request never waits on that work, page speed does not depend on how slow the source site happens to be.',
  },
  {
    title: 'New books stream onto the page as they are found',
    body:
      'The browser session sends results back over a WebSocket while it works, so the grid fills in front of you. The indicator in the navigation bar reads "Scraping live" for exactly as long as that is true, and "Session ready" when the connection is open but idle.',
  },
]

const stack = [
  {
    group: 'Application',
    items: [
      {
        name: 'Next.js and React',
        purpose:
          'render the site and handle navigation between pages without a full reload, which is what lets the product grid update in place while a scrape is running.',
      },
      {
        name: 'TypeScript',
        purpose:
          'describes the shape of a category, a book and a scrape message once, so the front end and the API cannot quietly disagree about them.',
      },
      {
        name: 'Tailwind CSS',
        purpose:
          'holds the design system — colour, spacing and type scale — in one place, so a change to the palette reaches every page at once.',
      },
      {
        name: 'SWR',
        purpose:
          'caches API responses in the browser and revalidates them in the background, which keeps the navigation menu instant after the first visit.',
      },
    ],
  },
  {
    group: 'Server',
    items: [
      {
        name: 'NestJS',
        purpose:
          'organises the API into modules with explicit dependencies, and validates every query string before it reaches the database.',
      },
      {
        name: 'PostgreSQL with TypeORM',
        purpose:
          'stores the catalogue. The data is genuinely relational — a heading owns categories, a category owns books, a book owns its detail — and the rules that prevent duplicates are enforced by the database rather than by application code.',
      },
      {
        name: 'Redis and BullMQ',
        purpose:
          'carry the job queue and a short-lived response cache. Scrapes are queued instead of run inside a request, and repeated requests for the same page are answered without touching the database again.',
      },
      {
        name: 'Socket.IO',
        purpose:
          'keeps the live connection open between the browser session and your page, so results and progress can be pushed as they happen instead of polled for.',
      },
    ],
  },
  {
    group: 'Scraping',
    items: [
      {
        name: 'Crawlee',
        purpose:
          'manages the request queue, retries and backoff for every kind of scrape, so politeness is handled in one place rather than reimplemented per page type.',
      },
      {
        name: 'Playwright',
        purpose:
          'drives a real browser for the parts of the site that need one: the mega-menu that defines the sections, and the product pages that carry description and specifications.',
      },
      {
        name: 'The Shopify product feed',
        purpose:
          'supplies the listings. Category grids are built in the browser by Algolia, so a headless browser never sees any products in them; the same catalogue is published as structured JSON, which robots.txt permits, and that is read instead.',
      },
    ],
  },
]

const decisions = [
  {
    title: 'A category belongs to a heading',
    body:
      'World of Books lists the same collection under more than one heading — "Trending Now" appears under both Fiction and Non-Fiction. Treating a category as a name on its own meant the second listing overwrote the first, and a section that shows 27 categories on the real site showed 25 here. Each listing is now kept separately, with its own record of how far it has been read.',
  },
  {
    title: 'Nothing is scraped twice without reason',
    body:
      'Each category remembers the last page fetched and whether it has been read to the end. A collection that is finished stops generating requests entirely, so browsing it again costs the source site nothing.',
  },
  {
    title: 'An empty answer is never cached',
    body:
      'If a request fails or returns nothing, that result is discarded rather than stored. Otherwise a single momentary failure would be served back as though it were a real, empty category for as long as the cache entry lived.',
  },
  {
    title: 'Nothing is invented',
    body:
      'World of Books publishes no ratings or reviews, so none are shown. Where a book has no author in the source data — which is common for DVDs and CDs — the line is left out rather than filled with a guess.',
  },
]

export default function AboutPage() {
  return (
    <div className="container max-w-3xl space-y-14 py-12">
      <header className="border-b pb-8">
        <p className="label-meta">About this project</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          A catalogue explorer for World of Books
        </h1>
        <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
          <p>
            World of Books sells second-hand books, and this application lets you browse its
            catalogue: the six sections of its menu, the categories inside each of them, and
            the books those categories contain, down to the description and specifications of
            an individual title.
          </p>
          <p>
            It holds no catalogue of its own. Everything you see here was read from
            worldofbooks.com the first time somebody asked for it, and then kept, so the next
            person to open the same category is served from storage instead of sending the
            site another request.
          </p>
        </div>
      </header>

      <section>
        <h2 className="font-display text-2xl font-semibold">How it works</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Opening a category sets off four things in sequence. They are worth reading in
          order, because each one exists to keep the page responsive while a slow scrape
          happens somewhere else.
        </p>
        <ol className="mt-6 divide-y divide-border border-y border-border">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5 py-6">
              <span className="font-mono text-sm text-highlight">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">The technologies, and what each is for</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Each of these was chosen for a specific job rather than for its own sake, so it is
          worth saying plainly what that job is.
        </p>
        <div className="mt-6 space-y-8">
          {stack.map((group) => (
            <div key={group.group}>
              <p className="label-meta">{group.group}</p>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                {group.items.map((item) => (
                  <div key={item.name} className="py-4">
                    <dt className="inline font-medium">{item.name} </dt>
                    <dd className="inline text-sm leading-relaxed text-muted-foreground">
                      {item.purpose}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Decisions behind the design</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          A few choices shaped the rest of the application, and each of them came out of a
          problem that showed up in practice.
        </p>
        <dl className="mt-6 divide-y divide-border border-y border-border">
          {decisions.map((entry) => (
            <div key={entry.title} className="py-5">
              <dt className="font-medium">{entry.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {entry.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-dashed p-6">
        <h2 className="font-display text-xl font-semibold">On scraping responsibly</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Requests are queued rather than run in parallel, retried with increasing delays
          when a page fails, and stopped altogether once a collection has been read to the
          end. Listings come from a JSON endpoint that the site&apos;s robots.txt permits. This
          is a demonstration project rather than a commercial mirror, and the catalogue it
          displays belongs to World of Books.
        </p>
        <Link
          href="/readme"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Read the full technical documentation
        </Link>
      </section>
    </div>
  )
}
