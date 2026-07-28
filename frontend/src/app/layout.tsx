import type { Metadata } from 'next'
import { Fraunces, Public_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/providers/AppProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { StartAtHome } from '@/components/layout/StartAtHome'

// Display: a bookish serif with an optical-size axis, used only for headings and the
// wordmark. Body: a plain grotesque that stays legible at the sizes a catalogue needs.
// Mono: counts, prices and scraper status, so numbers line up column to column.
const display = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-display',
  display: 'swap',
})

const sans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'World of Books Explorer',
  description: 'Browse the World of Books catalogue — live category scraping, stored results.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} flex min-h-screen flex-col font-sans`}
      >
        <AppProvider>
          <StartAtHome />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  )
}
