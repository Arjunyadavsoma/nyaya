/**
 * Turso-aware Prisma client for seed scripts.
 * Detects TURSO_DATABASE_URL and uses the libSQL adapter.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

export function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    console.log("[db] Using Turso (libSQL) for production database");
    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  console.log("[db] Using local SQLite for development");
  return new PrismaClient();
}
