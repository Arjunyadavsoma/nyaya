/**
 * Apply the Prisma schema to Turso (libSQL) directly via raw SQL.
 * This is needed because Prisma's `db push` doesn't support libsql:// URLs
 * with the SQLite provider — only the driver adapter at runtime does.
 *
 * Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... bun run src/lib/seed/apply-turso-schema.ts
 */
import { createClient } from "@libsql/client";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set");
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const TABLES = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "authProvider" TEXT NOT NULL DEFAULT 'guest',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`,

  `CREATE TABLE IF NOT EXISTS "Profile" (
    "userId" TEXT PRIMARY KEY NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "emergencyContactsJson" TEXT NOT NULL DEFAULT '[]',
    "hasConsentedLocation" BOOLEAN NOT NULL DEFAULT false,
    "hasConsentedChatStorage" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "LegalSource" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'india',
    "sourceUrl" TEXT NOT NULL,
    "effectiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LegalSource_slug_key" ON "LegalSource"("slug")`,

  `CREATE TABLE IF NOT EXISTS "LegalDocument" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "sourceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("sourceId") REFERENCES "LegalSource"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocument_slug_key" ON "LegalDocument"("slug")`,
  `CREATE INDEX IF NOT EXISTS "LegalDocument_documentId_idx" ON "LegalDocument"("documentId")`,

  `CREATE TABLE IF NOT EXISTS "LegalChunk" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionNo" TEXT,
    "actName" TEXT,
    "effectiveDate" DATETIME,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "LegalChunk_documentId_idx" ON "LegalChunk"("documentId")`,
  `CREATE INDEX IF NOT EXISTS "LegalChunk_sectionNo_idx" ON "LegalChunk"("sectionNo")`,

  `CREATE TABLE IF NOT EXISTS "RightsTopic" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RightsTopic_slug_key" ON "RightsTopic"("slug")`,

  `CREATE TABLE IF NOT EXISTS "RightsArticle" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "topicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actualLaw" TEXT NOT NULL,
    "example" TEXT,
    "whatToDoIfViolated" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "jurisdiction" TEXT NOT NULL DEFAULT 'india',
    "sourceUrl" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("topicId") REFERENCES "RightsTopic"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RightsArticle_slug_key" ON "RightsArticle"("slug")`,
  `CREATE INDEX IF NOT EXISTS "RightsArticle_topicId_idx" ON "RightsArticle"("topicId")`,
  `CREATE INDEX IF NOT EXISTS "RightsArticle_status_idx" ON "RightsArticle"("status")`,

  `CREATE TABLE IF NOT EXISTS "EmergencyScenario" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "whatToDo" TEXT NOT NULL,
    "whatToSay" TEXT,
    "whatNotToDo" TEXT,
    "whatToKeep" TEXT,
    "applicableLaw" TEXT,
    "authority" TEXT,
    "offlineCached" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EmergencyScenario_slug_key" ON "EmergencyScenario"("slug")`,

  `CREATE TABLE IF NOT EXISTS "Helpline" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "available24x7" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "order" INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Helpline_number_key" ON "Helpline"("number")`,

  `CREATE TABLE IF NOT EXISTS "PoliceStation" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "openHours" TEXT,
    "jurisdiction" TEXT,
    "source" TEXT NOT NULL DEFAULT 'osm',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "PoliceStation_state_idx" ON "PoliceStation"("state")`,
  `CREATE INDEX IF NOT EXISTS "PoliceStation_city_idx" ON "PoliceStation"("city")`,

  `CREATE TABLE IF NOT EXISTS "Judge" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "courtLevel" TEXT NOT NULL,
    "state" TEXT,
    "courtName" TEXT,
    "appointmentYear" INTEGER,
    "education" TEXT,
    "careerTimeline" TEXT,
    "photoUrl" TEXT,
    "officialSourceUrl" TEXT NOT NULL,
    "notableJudgmentsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "Judge_courtLevel_idx" ON "Judge"("courtLevel")`,
  `CREATE INDEX IF NOT EXISTS "Judge_state_idx" ON "Judge"("state")`,

  `CREATE TABLE IF NOT EXISTS "SCJudgment" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "caseName" TEXT NOT NULL,
    "year" INTEGER,
    "dateStr" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Supreme Court of India',
    "sourceUrl" TEXT NOT NULL DEFAULT 'https://main.sci.gov.in/judgments',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "SCJudgment_year_idx" ON "SCJudgment"("year")`,
  `CREATE INDEX IF NOT EXISTS "SCJudgment_caseName_idx" ON "SCJudgment"("caseName")`,

  `CREATE TABLE IF NOT EXISTS "LegalInfoArticle" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "state" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LegalInfoArticle_slug_key" ON "LegalInfoArticle"("slug")`,
  `CREATE INDEX IF NOT EXISTS "LegalInfoArticle_category_idx" ON "LegalInfoArticle"("category")`,

  `CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'md',
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_slug_key" ON "DocumentTemplate"("slug")`,

  `CREATE TABLE IF NOT EXISTS "ChatSession" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'know-the-law',
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citationsJson" TEXT NOT NULL DEFAULT '[]',
    "mode" TEXT,
    "helpful" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId")`,

  `CREATE TABLE IF NOT EXISTS "Citation" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "messageId" TEXT,
    "actName" TEXT NOT NULL,
    "sectionNo" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_type_refId_key" ON "Bookmark"("userId", "type", "refId")`,
  `CREATE INDEX IF NOT EXISTS "Bookmark_userId_idx" ON "Bookmark"("userId")`,

  `CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT,
    "messageId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "ContentReport" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "ContentReport_status_idx" ON "ContentReport"("status")`,

  `CREATE TABLE IF NOT EXISTS "ContentReview" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "contentType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT PRIMARY KEY NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "GroqKeyUsage" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "keyId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GroqKeyUsage_keyId_model_date_key" ON "GroqKeyUsage"("keyId", "model", "date")`,
  `CREATE INDEX IF NOT EXISTS "GroqKeyUsage_keyId_date_idx" ON "GroqKeyUsage"("keyId", "date")`,
];

async function main() {
  console.log("[apply-turso-schema] Applying schema to Turso...");
  console.log(`[apply-turso-schema] URL: ${TURSO_URL}`);

  for (const sql of TABLES) {
    try {
      await client.execute(sql);
    } catch (err) {
      // Index-already-exists errors are fine
      const msg = String(err);
      if (!msg.includes("already exists")) {
        console.error(`[apply-turso-schema] Error: ${msg.slice(0, 200)}`);
      }
    }
  }

  console.log(`[apply-turso-schema] ✅ Schema applied (${TABLES.length} statements)`);

  // Verify by listing tables
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log(`[apply-turso-schema] Tables created: ${result.rows.length}`);
  for (const row of result.rows) {
    console.log(`  - ${row.name}`);
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
