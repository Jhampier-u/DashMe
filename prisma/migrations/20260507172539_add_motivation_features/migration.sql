-- CreateTable
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Habit" ("color", "createdAt", "icon", "id", "name") SELECT "color", "createdAt", "icon", "id", "name" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE TABLE "new_HabitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "shielded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HabitLog" ("createdAt", "date", "habitId", "id") SELECT "createdAt", "date", "habitId", "id" FROM "HabitLog";
DROP TABLE "HabitLog";
ALTER TABLE "new_HabitLog" RENAME TO "HabitLog";
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "shields" INTEGER NOT NULL DEFAULT 2,
    "shieldsUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Player" ("createdAt", "id", "updatedAt", "xp") SELECT "createdAt", "id", "updatedAt", "xp" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyQuest_date_idx" ON "DailyQuest"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuest_date_kind_key" ON "DailyQuest"("date", "kind");
