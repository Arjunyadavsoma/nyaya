import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * Database client — works with BOTH local SQLite (development) and
 * Turso/libSQL (production on Vercel).
 *
 * Detection logic:
 * - If DATABASE_URL starts with "libsql:" → use Turso adapter (production)
 * - If DATABASE_URL starts with "file:" → use local SQLite (development)
 *
 * On Vercel: set DATABASE_URL=libsql://...?authToken=...
 * On local dev: set DATABASE_URL=file:./db/custom.db
 */

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db';

  if (dbUrl.startsWith('libsql:')) {
    // Production: Turso (libSQL over HTTP)
    // Parse authToken from URL query string if present, or from env var
    const url = new URL(dbUrl);
    const authToken = url.searchParams.get('authToken') || process.env.TURSO_AUTH_TOKEN;
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    const libsql = createClient({
      url: baseUrl,
      authToken: authToken || undefined,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as never);
  }

  // Development: local SQLite file
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
