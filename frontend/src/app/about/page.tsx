    import { BookOpen, Globe, Shield, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

export default function AboutPage() {
  const features = [
    {
      icon: BookOpen,
      title: "Comprehensive Catalog",
      description: "Access millions of books from World of Books with real-time data scraping."
    },
    {
      icon: Zap,
      title: "Real-time Updates",
      description: "Fresh product data with on-demand scraping and intelligent caching."
    },
    {
      icon: Shield,
      title: "Ethical Scraping",
      description: "Respectful data collection with rate limiting and proper delays."
    },
    {
      icon: Globe,
      title: "Global Access",
      description: "Accessible from anywhere with responsive design and localization."
    }
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">About World of Books Explorer</h1>
        <p className="text-lg text-muted-foreground">
          A production-ready product exploration platform built with modern web technologies.
        </p>
      </div>

      {/* Features */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tech Stack */}
      <Card>
        <CardHeader>
          <CardTitle>Technology Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-semibold">Frontend</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Next.js 14 with App Router</li>
                <li>• TypeScript for type safety</li>
                <li>• Tailwind CSS for styling</li>
                <li>• SWR for data fetching</li>
                <li>• Radix UI for accessible components</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-semibold">Backend</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• NestJS with TypeScript</li>
                <li>• PostgreSQL for data storage</li>
                <li>• Redis for caching and queues</li>
                <li>• Bull.js for job processing</li>
                <li>• Crawlee + Playwright for scraping</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader>
          <CardTitle>System Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The platform follows a modern microservices-inspired architecture with clear separation of concerns:
            </p>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-medium">1.</span>
                <span>Frontend serves as a responsive client with real-time updates</span>
              </li>
              <li className="flex gap-3">
                <span className="font-medium">2.</span>
                <span>Backend API handles business logic and data management</span>
              </li>
              <li className="flex gap-3">
                <span className="font-medium">3.</span>
                <span>Scraping workers process jobs asynchronously</span>
              </li>
              <li className="flex gap-3">
                <span className="font-medium">4.</span>
                <span>Redis cache reduces external API calls</span>
              </li>
              <li className="flex gap-3">
                <span className="font-medium">5.</span>
                <span>PostgreSQL ensures data persistence and relationships</span>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}