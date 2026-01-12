import Link from "next/link"
import { BookOpen, Github, Twitter, Linkedin } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    Product: [
      { href: "/", label: "Home" },
      { href: "/products", label: "Products" },
      { href: "/categories", label: "Categories" },
    ],
    Company: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/readme", label: "Documentation" },
    ],
    Legal: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  }

  const socialLinks = [
    { href: "https://github.com", icon: Github, label: "GitHub" },
    { href: "https://twitter.com", icon: Twitter, label: "Twitter" },
    { href: "https://linkedin.com", icon: Linkedin, label: "LinkedIn" },
  ]

  return (
    <footer className="mt-auto border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">World of Books</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Product exploration platform with real-time scraping.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.href}  // Use href as key
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={link.label}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Links - FIXED: Use combination of category and href for unique keys */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 font-semibold">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={`${category}-${link.href}`}> {/* Unique key */}
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} World of Books Explorer. All rights reserved.
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> • </span>
            Built with Next.js, NestJS, and ethical scraping.
          </p>
          <p className="mt-2 text-xs">
            This project is for demonstration purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}