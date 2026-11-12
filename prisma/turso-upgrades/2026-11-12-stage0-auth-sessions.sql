-- Stage 0 incremental migration: applies ONLY the auth/session/security
-- changes on top of an existing database that was created via
-- `prisma db push` (the pre-migration deployment method).
--
-- Safe on a fresh database too: every statement is guarded with
-- "IF NOT EXISTS" / additive column adds.
--
-- NOTE: this file documents the incremental path. The canonical baseline
-- for NEW deployments is 20261112141804_stage0_auth_sessions_security.

-- CreateTable (new)
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "rotatedFrom" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable (new)
CREATE TABLE IF NOT EXISTS "RateLimitHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bucketKey" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RateLimitHit_bucketKey_windowStart_key" UNIQUE ("bucketKey", "windowStart")
);

-- CreateIndex (new)
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "RateLimitHit_windowStart_idx" ON "RateLimitHit"("windowStart");

-- AlterTable: additive User columns (existing rows unaffected)
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "failedLogins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME;
