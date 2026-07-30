/**
 * One place where the Postgres and Redis connection settings are resolved.
 *
 * Managed hosts hand out a connection in one of two shapes: a single URL (Neon, Supabase,
 * Upstash, Railway, Heroku, Fly) or discrete host/port/password fields (Render's internal
 * networking, docker-compose, a local install). Both are accepted here, so the same build
 * deploys to any of them with only environment changes.
 *
 * Precedence is URL first, then the discrete fields, then the local defaults.
 */

/** The subset of ioredis options the queues and the cache need. */
export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: { servername: string; rejectUnauthorized: boolean };
}

/**
 * Whether a host is reached over a network that needs TLS, inferred from whether the name is
 * qualified. Everything private is a bare name — `localhost`, a docker-compose service, a Render
 * internal hostname like `dpg-abc123-a` — while everything public is qualified:
 * `ep-x.aws.neon.tech`, `dpg-abc123-a.oregon-postgres.render.com`. An IP literal is treated as
 * private, which covers a LAN database and mirrors how these are used in practice.
 */
function isPublicHost(host: string): boolean {
  if (!host.includes('.')) return false;
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isTrue(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'require'].includes(value.toLowerCase());
}

function isFalse(value: string | undefined): boolean {
  return value !== undefined && ['0', 'false', 'no', 'disable'].includes(value.toLowerCase());
}

/** `new URL()` throws on a malformed value; a bad connection string should say so plainly. */
function parseUrl(raw: string, variable: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new Error(`${variable} is not a valid URL: ${raw}`);
  }
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

/**
 * TLS is required by every managed Postgres reachable over the public internet, and refused by a
 * plaintext local or private-network one, so the default follows the host. `DB_SSL` overrides it
 * either way.
 *
 * `rejectUnauthorized` is false by default because several providers (Render, Heroku) terminate
 * TLS with a certificate that is not in Node's trust store, and a verified chain there needs the
 * provider's CA file on disk. Set `DB_SSL_REJECT_UNAUTHORIZED=true` where the chain is public
 * (Neon, Supabase) to get full verification.
 */
function postgresSsl(host: string): false | { rejectUnauthorized: boolean } {
  const enabled = isTrue(process.env.DB_SSL)
    ? true
    : isFalse(process.env.DB_SSL)
      ? false
      : isPublicHost(host);

  if (!enabled) return false;
  return { rejectUnauthorized: isTrue(process.env.DB_SSL_REJECT_UNAUTHORIZED) };
}

/**
 * Connection half of the TypeORM options — no entities, no synchronize, so both the app module
 * and the seed script can spread it into their own config.
 */
export function postgresConnection(): {
  type: 'postgres';
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl: false | { rejectUnauthorized: boolean };
} {
  const url = process.env.DATABASE_URL;

  if (url) {
    // TypeORM parses the URL itself; it is read here only to decide on TLS.
    const parsed = parseUrl(url, 'DATABASE_URL');
    return { type: 'postgres', url, ssl: postgresSsl(parsed.hostname) };
  }

  const host = process.env.DB_HOST || 'localhost';
  return {
    type: 'postgres',
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'wob_explorer',
    ssl: postgresSsl(host),
  };
}

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

/**
 * Discrete fields, for Bull — which drives ioredis and wants an options object rather than a URL.
 * A `rediss://` scheme or `REDIS_TLS` turns on TLS; Upstash and Aiven require it.
 *
 * `servername` is not optional in practice. A URL-configured client derives the SNI name from
 * the URL, but options built by hand carry none, and a managed endpoint that fronts many
 * tenants on one address cannot pick a certificate without it — the handshake then simply never
 * completes. Render's external endpoint behaves exactly that way: the cache connected over its
 * URL while the queue, configured from these fields, timed out on every command.
 */
export function redisConnection(): RedisConnection {
  const url = process.env.REDIS_URL;

  if (url) {
    const parsed = parseUrl(url, 'REDIS_URL');
    const tls = parsed.protocol === 'rediss:' || isTrue(process.env.REDIS_TLS);
    // The path of redis://host:6379/2 selects database 2.
    const db = parseInt(parsed.pathname.replace('/', '') || '0');

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      // decodeURIComponent: providers percent-encode passwords containing URL-reserved bytes.
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(Number.isNaN(db) || db === 0 ? {} : { db }),
      ...(tls ? { tls: { servername: parsed.hostname, rejectUnauthorized: false } } : {}),
    };
  }

  const tls = isTrue(process.env.REDIS_TLS);
  const host = process.env.REDIS_HOST || 'localhost';
  return {
    host,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(tls ? { tls: { servername: host, rejectUnauthorized: false } } : {}),
  };
}

/**
 * The same connection as a URL, for cache-manager-redis-store — it hands its config straight to
 * node-redis v4, which reads `url` and ignores loose host/port keys.
 */
export function redisConnectionUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const { host, port, username, password, tls } = redisConnection();
  const scheme = tls ? 'rediss' : 'redis';
  const auth = password
    ? `${encodeURIComponent(username ?? 'default')}:${encodeURIComponent(password)}@`
    : '';

  return `${scheme}://${auth}${host}:${port}`;
}
