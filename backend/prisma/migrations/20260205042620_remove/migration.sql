/*
  Warnings:

  - You are about to drop the column `presentedAt` on the `TeamPresentation` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamPresentation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "presentationSeconds" INTEGER NOT NULL,
    "qaSeconds" INTEGER NOT NULL,
    CONSTRAINT "TeamPresentation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamPresentation" ("id", "presentationSeconds", "qaSeconds", "teamId") SELECT "id", "presentationSeconds", "qaSeconds", "teamId" FROM "TeamPresentation";
DROP TABLE "TeamPresentation";
ALTER TABLE "new_TeamPresentation" RENAME TO "TeamPresentation";
CREATE INDEX "TeamPresentation_teamId_idx" ON "TeamPresentation"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
