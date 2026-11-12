-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "authProvider" TEXT NOT NULL DEFAULT 'guest',
    "passwordHash" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
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

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "emergencyContactsJson" TEXT NOT NULL DEFAULT '[]',
    "hasConsentedLocation" BOOLEAN NOT NULL DEFAULT false,
    "hasConsentedChatStorage" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'india',
    "sourceUrl" TEXT NOT NULL,
    "effectiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "LegalDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LegalSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "sectionNo" TEXT,
    "actName" TEXT,
    "effectiveDate" DATETIME,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RightsTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RightsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "RightsArticle_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "RightsTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmergencyScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
);

-- CreateTable
CREATE TABLE "Helpline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "available24x7" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PoliceStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
);

-- CreateTable
CREATE TABLE "SCJudgment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseName" TEXT NOT NULL,
    "year" INTEGER,
    "dateStr" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Supreme Court of India',
    "sourceUrl" TEXT NOT NULL DEFAULT 'https://main.sci.gov.in/judgments',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LegalInfoArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'md',
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'know-the-law',
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citationsJson" TEXT NOT NULL DEFAULT '[]',
    "mode" TEXT,
    "helpful" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "actName" TEXT NOT NULL,
    "sectionNo" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "messageId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroqKeyUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bucketKey" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalSource_slug_key" ON "LegalSource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");

-- CreateIndex
CREATE INDEX "LegalChunk_documentId_idx" ON "LegalChunk"("documentId");

-- CreateIndex
CREATE INDEX "LegalChunk_sectionNo_idx" ON "LegalChunk"("sectionNo");

-- CreateIndex
CREATE UNIQUE INDEX "RightsTopic_slug_key" ON "RightsTopic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RightsArticle_slug_key" ON "RightsArticle"("slug");

-- CreateIndex
CREATE INDEX "RightsArticle_topicId_idx" ON "RightsArticle"("topicId");

-- CreateIndex
CREATE INDEX "RightsArticle_status_idx" ON "RightsArticle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyScenario_slug_key" ON "EmergencyScenario"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Helpline_number_key" ON "Helpline"("number");

-- CreateIndex
CREATE INDEX "PoliceStation_state_idx" ON "PoliceStation"("state");

-- CreateIndex
CREATE INDEX "PoliceStation_city_idx" ON "PoliceStation"("city");

-- CreateIndex
CREATE INDEX "Judge_courtLevel_idx" ON "Judge"("courtLevel");

-- CreateIndex
CREATE INDEX "Judge_state_idx" ON "Judge"("state");

-- CreateIndex
CREATE INDEX "SCJudgment_year_idx" ON "SCJudgment"("year");

-- CreateIndex
CREATE INDEX "SCJudgment_caseName_idx" ON "SCJudgment"("caseName");

-- CreateIndex
CREATE UNIQUE INDEX "LegalInfoArticle_slug_key" ON "LegalInfoArticle"("slug");

-- CreateIndex
CREATE INDEX "LegalInfoArticle_category_idx" ON "LegalInfoArticle"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_slug_key" ON "DocumentTemplate"("slug");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_type_refId_key" ON "Bookmark"("userId", "type", "refId");

-- CreateIndex
CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "GroqKeyUsage_keyId_date_idx" ON "GroqKeyUsage"("keyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GroqKeyUsage_keyId_model_date_key" ON "GroqKeyUsage"("keyId", "model", "date");

-- CreateIndex
CREATE INDEX "RateLimitHit_windowStart_idx" ON "RateLimitHit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitHit_bucketKey_windowStart_key" ON "RateLimitHit"("bucketKey", "windowStart");
