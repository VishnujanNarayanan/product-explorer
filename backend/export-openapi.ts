/**
 * Writes the OpenAPI document to docs/openapi.json so the API contract is readable — and
 * diffable in review — without running the server.
 *
 *   npm run openapi:export
 *
 * Uses the same builder as main.ts. It boots the Nest application context, so PostgreSQL and
 * Redis need to be reachable; the server itself is never listened on.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './src/app.module';
import { buildSwaggerConfig } from './src/swagger.config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig(new DocumentBuilder()));
  await app.close();

  const outDir = join(__dirname, '..', 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'openapi.json');
  writeFileSync(outFile, JSON.stringify(document, null, 2));

  const paths = Object.keys(document.paths).length;
  const schemas = Object.keys(document.components?.schemas ?? {}).length;
  console.log(`wrote ${outFile}  (${paths} paths, ${schemas} schemas)`);

  // BullMQ holds open Redis sockets that `app.close()` does not release, so the event loop
  // never drains and the process would hang after the file is written.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
