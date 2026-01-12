"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search, Home, BookOpen, ShoppingBag, User, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useNavigation } from "@/lib/hooks/useNavigation"
import { SearchBar } from "../shared/SearchBar"
import { ThemeToggle } from "../shared/ThemeToggle"
import { useState } from "react"

export function Header() {
  const pathname = usePathname()
  const { navigation } = useNavigation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/products", label: "Products", icon: ShoppingBag },
    { href: "/categories", label: "Categories", icon: LayoutGrid }, // Changed from Grid3X3 to LayoutGrid
    { href: "/about", label: "About", icon: BookOpen },
    { href: "/contact", label: "Contact", icon: User },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold hidden sm:inline">World of Books</span>
            <span className="text-xl font-bold sm:hidden">WOB</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
          
          {/* Navigation Dropdown */}
          {navigation.length > 0 && (
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                Browse <span className="hidden lg:inline">Categories</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              <div className="absolute top-full left-0 mt-2 w-48 rounded-md border bg-popover p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {navigation.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/categories?navigation=${item.slug}`}
                    className="block rounded px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:block">
            <SearchBar />
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Mobile Menu */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="container pb-4 md:hidden">
        <SearchBar />
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t">
          <div className="container py-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
              
              {/* Mobile Navigation Links */}
              {navigation.length > 0 && (
                <div className="pt-2 border-t mt-2">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Browse Categories
                  </div>
                  {navigation.slice(0, 8).map((item) => (
                    <Link
                      key={item.id}
                      href={`/categories?navigation=${item.slug}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}