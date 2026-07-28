"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { SearchBar } from "../shared/SearchBar"
import { CategoryBar } from "./CategoryBar"

const utilityLinks = [
  { href: "/", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function Header() {
  const pathname = usePathname()
  const { navigation } = useNavigation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  // A route change means the menu did its job.
  useEffect(() => {
    setMobileMenuOpen(false)
    setOpenSection(null)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* Utility row: who we are, what you can search, how you see it. */}
      <div className="container flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="World of Books Explorer, home">
          <span aria-hidden className="h-8 w-1.5 rounded-full bg-brand dark:bg-primary" />
          <span className="leading-none">
            <span className="block font-display text-lg font-semibold tracking-tight">
              World of Books
            </span>
            <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
              Explorer
            </span>
          </span>
        </Link>

        <div className="ml-auto hidden flex-1 justify-end md:flex">
          <SearchBar />
        </div>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Site">
          {utilityLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors hover:text-foreground ${
                pathname === link.href ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <CategoryBar navigation={navigation} />

      {/* Mobile: search plus the same sections, opened one at a time. */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="container space-y-4 py-4">
            <div className="md:hidden">
              <SearchBar />
            </div>

            <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Site">
              {utilityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm ${
                    pathname === link.href ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="divide-y divide-border border-y border-border">
              {navigation.map((section) => {
                const isOpen = openSection === section.slug
                const categories = section.categories ?? []
                return (
                  <div key={section.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : section.slug)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between py-3 text-left text-sm font-medium"
                    >
                      {section.title}
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          {categories.length}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pb-3">
                        {categories.map((category) => (
                          <Link
                            key={`${section.slug}-${category.id}`}
                            href={`/products?category=${category.slug}&navigation=${section.slug}`}
                            className="flex items-baseline justify-between gap-3 border-l-2 border-transparent py-2 pl-3 text-sm text-muted-foreground hover:border-highlight hover:text-foreground"
                          >
                            <span className="truncate">{category.title}</span>
                            {category.product_count > 0 && (
                              <span className="font-mono text-[0.6875rem] text-highlight">
                                {category.product_count}
                              </span>
                            )}
                          </Link>
                        ))}
                        <Link
                          href={`/categories?navigation=${section.slug}`}
                          className="mt-1 inline-block pl-3 text-sm font-medium text-primary"
                        >
                          Browse the whole section
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
