/**
 * Turso-aware Prisma client for seed scripts.
 * Uses TURSO_DATABASE_URL if set, otherwise local SQLite.
 * IMPORTANT: When using the adapter, we must NOT set DATABASE_URL
 * to a libsql:// URL — Prisma's schema validation rejects it.
 * Instead, we unset DATABASE_URL so Prisma falls back to the schema's
 * hardcoded file: URL, and the adapter takes over the connection.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

export function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    console.log("[db] Using Turso (libSQL) for production database");
    console.log(`[db] URL: ${tursoUrl}`);
    // When using the adapter, Prisma should NOT read DATABASE_URL.
    // Delete it so Prisma falls back to the schema's hardcoded file: URL.
    delete process.env.DATABASE_URL;
    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  console.log("[db] Using local SQLite for development");
  return new PrismaClient();
}
