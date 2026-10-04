import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * Database client — dual mode:
 *
 * LOCAL DEV: Uses local SQLite file via Prisma (DATABASE_URL=file:...)
 * PRODUCTION (Vercel): Uses Turso via @prisma/adapter-libsql
 *
 * The schema.prisma has a hardcoded file: URL so Prisma's build-time
 * validation passes. At runtime:
 *
 * - If TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set → use the libSQL adapter
 *   (we delete DATABASE_URL so Prisma doesn't try to validate it)
 * - Otherwise → use local SQLite via PrismaClient directly
 *
 * On Vercel, set these env vars:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=eyJhbGciOi...
 *
 * Do NOT set DATABASE_URL to libsql:// on Vercel — Prisma will reject it.
 */

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // PRODUCTION: Turso via driver adapter
    // CRITICAL: Delete DATABASE_URL so Prisma doesn't try to validate
    // it against the sqlite provider (which only accepts file: protocol).
    // The adapter handles the actual connection.
    delete process.env.DATABASE_URL;

    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    const adapter = new PrismaLibSQL(libsql);
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
