-- CreateTable
CREATE TABLE "KnowledgeAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalSourceId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amendmentDate" DATETIME,
    "effectiveDate" DATETIME,
    "gazetteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceSlug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsAdded" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorText" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LegalAidBody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "stateCode" TEXT,
    "district" TEXT,
    "name" TEXT NOT NULL,
    "helpline" TEXT,
    "email" TEXT,
    "address" TEXT,
    "website" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "KnowledgeAmendment_sourceSlug_amendmentDate_idx" ON "KnowledgeAmendment"("sourceSlug", "amendmentDate");

-- CreateIndex
CREATE INDEX "IngestionRun_sourceSlug_startedAt_idx" ON "IngestionRun"("sourceSlug", "startedAt");

-- CreateIndex
CREATE INDEX "LegalAidBody_level_stateCode_idx" ON "LegalAidBody"("level", "stateCode");

-- CreateIndex
CREATE INDEX "LegalAidBody_verified_idx" ON "LegalAidBody"("verified");
