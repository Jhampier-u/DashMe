-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'star',
    "color" TEXT NOT NULL DEFAULT 'moss',
    "plantSpecies" TEXT NOT NULL DEFAULT 'flower',
    "minimalGoal" TEXT,
    "isAnchor" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL DEFAULT '1111111',
    "intention" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Habit" ("color", "createdAt", "icon", "id", "minimalGoal", "name", "plantSpecies") SELECT "color", "createdAt", "icon", "id", "minimalGoal", "name", "plantSpecies" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
