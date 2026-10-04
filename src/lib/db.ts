import { PrismaClient } from '@prisma/client'

/**
 * Database client.
 *
 * Uses PrismaClient directly with whatever DATABASE_URL is in the env.
 * - Local dev: DATABASE_URL=file:/path/to/db/custom.db (SQLite)
 * - Vercel prod: DATABASE_URL=libsql://... (Turso via Prisma's built-in libSQL support)
 *
 * The schema.prisma uses url = env("DATABASE_URL") so Prisma picks it up.
 * For Turso, set DATABASE_URL to: libsql://your-db.turso.io?authToken=YOUR_TOKEN
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
