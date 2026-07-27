import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Shared by the served docs (main.ts) and the committed spec (export-openapi.ts), so the two
 * cannot describe the API differently.
 */
export function buildSwaggerConfig(builder: DocumentBuilder) {
  return builder
    .setTitle('Product Data Explorer API')
    .setDescription(
      [
        'Navigate World of Books from headings → categories → products → product detail.',
        '',
        'Data is gathered by on-demand scraping and persisted to PostgreSQL. Listing endpoints',
        'return stored rows immediately and queue background work for the next unfetched page,',
        'so no request blocks on a scrape.',
        '',
        '**Reviews and ratings are always empty.** World of Books publishes no review or rating',
        'markup, and the assignment asks for reviews "if present" — so `review` stays unpopulated',
        'and `ratings_avg` stays null rather than being synthesised.',
        '',
        'Live scrape progress is pushed over Socket.IO on the `/api/ws` namespace, which is not',
        'described here (OpenAPI covers HTTP only).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addTag('catalogue', 'Navigation, categories, products and on-demand scraping')
    .addTag('products', 'Paged product listing')
    .addServer(`http://localhost:${process.env.PORT || 3001}`, 'Local development')
    .build();
}
