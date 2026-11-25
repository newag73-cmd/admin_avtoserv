CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "backup" TEXT,
    "updatedAt" DATETIME NOT NULL
);
