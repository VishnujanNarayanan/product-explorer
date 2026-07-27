# syntax=docker/dockerfile:1
#
# The scrapers drive a real Chromium through Playwright, so the runtime needs both the browser
# binary and its ~20 system libraries. Microsoft's Playwright image ships exactly that set, and
# pins it to a release — which matters here, because a browser build that does not match the
# `playwright` package fails at launch with a misleading "install dependencies" error. Keep
# PLAYWRIGHT_VERSION in step with the `playwright` dependency in package.json.
ARG PLAYWRIGHT_VERSION=1.57.0

# ---------- build ----------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------- runtime ----------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Seed fixture and schema, so `npm run seed` works inside the container.
COPY database ./database

# Crawlee writes its request queues and key-value store here.
RUN mkdir -p /app/storage && chown -R pwuser:pwuser /app/storage
USER pwuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
