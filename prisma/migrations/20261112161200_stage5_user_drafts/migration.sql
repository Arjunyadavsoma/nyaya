-- CreateTable
CREATE TABLE "UserDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workflowSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "currentText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'v1',
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "UserDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserDraft_userId_updatedAt_idx" ON "UserDraft"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "DraftVersion_draftId_createdAt_idx" ON "DraftVersion"("draftId", "createdAt");
