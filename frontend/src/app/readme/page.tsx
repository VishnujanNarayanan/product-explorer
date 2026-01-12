    import { Code, Database, GitBranch, Server, Shield, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

export default function ReadmePage() {
  const sections = [
    {
      icon: Zap,
      title: "Quick Start",
      content: (
        <div className="space-y-4">
          <p>Get the project running in minutes:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`# Clone the repository
git clone <repo-url>
cd product-explorer

# Set up environment
cp .env.example .env

# Start with Docker
docker-compose up -d

# Or run manually
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev`}
          </pre>
        </div>
      )
    },
    {
      icon: Server,
      title: "API Documentation",
      content: (
        <div className="space-y-4">
          <p>Key endpoints available:</p>
          <ul className="space-y-2 text-sm">
            <li><code className="bg-muted px-2 py-1 rounded">GET /api/navigation</code> - Get all navigation items</li>
            <li><code className="bg-muted px-2 py-1 rounded">GET /api/categories</code> - Get categories</li>
            <li><code className="bg-muted px-2 py-1 rounded">GET /api/products</code> - Get products</li>
            <li><code className="bg-muted px-2 py-1 rounded">POST /api/scrape/navigation</code> - Trigger navigation scrape</li>
            <li><code className="bg-muted px-2 py-1 rounded">POST /api/scrape/product/:id</code> - Refresh product data</li>
          </ul>
        </div>
      )
    },
    {
      icon: Database,
      title: "Database Schema",
      content: (
        <div className="space-y-4">
          <p>Main entities in PostgreSQL:</p>
          <ul className="space-y-2 text-sm">
            <li><strong>navigation</strong> - Top-level navigation items</li>
            <li><strong>category</strong> - Categories with parent-child relationships</li>
            <li><strong>product</strong> - Product information</li>
            <li><strong>product_detail</strong> - Extended product details</li>
            <li><strong>review</strong> - Customer reviews</li>
            <li><strong>scrape_job</strong> - Scraping job tracking</li>
            <li><strong>view_history</strong> - User browsing history</li>
          </ul>
        </div>
      )
    },
    {
      icon: Shield,
      title: "Ethical Scraping",
      content: (
        <div className="space-y-4">
          <p>We follow strict ethical scraping practices:</p>
          <ul className="space-y-2 text-sm">
            <li>• Respect robots.txt and terms of service</li>
            <li>• Implement rate limiting (3-second delays)</li>
            <li>• Cache results for 24 hours</li>
            <li>• Use exponential backoff for retries</li>
            <li>• Set proper User-Agent headers</li>
            <li>• Queue long-running jobs</li>
          </ul>
        </div>
      )
    },
    {
      icon: GitBranch,
      title: "Deployment",
      content: (
        <div className="space-y-4">
          <p>Deploy to production:</p>
          <div className="space-y-2">
            <h4 className="font-medium">Frontend (Vercel):</h4>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
{`# Build command
npm run build

# Environment variables
NEXT_PUBLIC_API_URL=https://your-backend.railway.app`}
            </pre>
            <h4 className="font-medium">Backend (Railway):</h4>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">
{`# Start command
npm run start:prod

# Required services
- PostgreSQL
- Redis
- Environment variables from .env`}
            </pre>
          </div>
        </div>
      )
    },
    {
      icon: Code,
      title: "Development",
      content: (
        <div className="space-y-4">
          <p>Development scripts:</p>
          <ul className="space-y-2 text-sm">
            <li><code className="bg-muted px-2 py-1 rounded">npm run dev</code> - Start development server</li>
            <li><code className="bg-muted px-2 py-1 rounded">npm run build</code> - Build for production</li>
            <li><code className="bg-muted px-2 py-1 rounded">npm run test</code> - Run tests</li>
            <li><code className="bg-muted px-2 py-1 rounded">npm run lint</code> - Check code quality</li>
            <li><code className="bg-muted px-2 py-1 rounded">npm run type-check</code> - TypeScript validation</li>
          </ul>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Documentation</h1>
        <p className="text-lg text-muted-foreground">
          Complete guide to the World of Books Explorer platform.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle>{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {section.content}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Project Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Project Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`product-explorer/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   ├── entities/          # TypeORM entities
│   │   └── main.ts           # Application entry
│   ├── database/             # Schema and migrations
│   └── test/                 # Backend tests
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/              # App router pages
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities and hooks
│   │   └── providers/        # Context providers
│   ├── cypress/              # E2E tests
│   └── public/               # Static assets
├── .github/workflows/        # CI/CD pipelines
├── docker-compose.yml        # Local development
└── README.md                 # Project documentation`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}