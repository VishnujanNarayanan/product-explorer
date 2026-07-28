/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // There is a second lockfile above this directory, and Next picks the outer one as the
  // workspace root. That moves the root away from where Tailwind's content globs and the
  // PostCSS config live, so newly written utility classes never get generated.
  turbopack: {
    root: __dirname,
  },
  // Emits .next/standalone: a self-contained server with only the node_modules it actually
  // needs, so the runtime image does not have to carry a full dependency tree.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.worldofbooks.com',
      },
      // World of Books is a Shopify storefront: every product image URL returned by
      // products.json and by the detail pages is served from Shopify's CDN, not from
      // worldofbooks.com. Without this entry next/image rejects every real product image.
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig