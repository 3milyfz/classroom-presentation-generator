-- CreateTable
CREATE TABLE "TeamPresentation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "presentationSeconds" INTEGER NOT NULL,
    "qaSeconds" INTEGER NOT NULL,
    "presentedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamPresentation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamPresentation_teamId_idx" ON "TeamPresentation"("teamId");
