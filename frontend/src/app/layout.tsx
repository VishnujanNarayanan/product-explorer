import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/providers/AppProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'World of Books Explorer',
  description: 'Product exploration platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProvider>
          <Header />
          <main className="min-h-screen container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  )
}