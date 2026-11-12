-- CreateTable
CREATE TABLE "ResearchReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "summaryJson" TEXT NOT NULL DEFAULT '{}',
    "searchProviderUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ResearchReport_userId_createdAt_idx" ON "ResearchReport"("userId", "createdAt");
