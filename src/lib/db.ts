import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

/**
 * Database client — dual mode:
 *
 * LOCAL DEV: Uses local SQLite file via PrismaClient
 * PRODUCTION (Vercel): Uses Turso via @prisma/adapter-libsql
 *
 * The schema.prisma has url = "file:./db/custom.db" hardcoded so
 * Prisma's build-time validation passes (sqlite provider only accepts
 * file: protocol).
 *
 * At runtime:
 * - If TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set → use PrismaLibSQL adapter
 *   (passing { url, authToken } config — the factory creates the libsql client internally)
 * - Otherwise → use plain PrismaClient with local SQLite
 *
 * On Vercel, set:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=eyJhbGciOi...
 *
 * Do NOT set DATABASE_URL on Vercel.
 */

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // PRODUCTION: Turso via PrismaLibSQL driver adapter
    // CRITICAL: PrismaLibSQL is a FACTORY that takes a config object,
    // NOT a pre-created libsql client. It creates the client internally.
    // Also delete DATABASE_URL so Prisma doesn't try to validate it.
    delete process.env.DATABASE_URL;

    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: tursoToken,
    });
    return new PrismaClient({ adapter });
  }

  // DEVELOPMENT: local SQLite file
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
