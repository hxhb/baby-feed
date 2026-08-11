CREATE TABLE "ToothEruption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "healthRecordId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "toothCode" TEXT NOT NULL,
    CONSTRAINT "ToothEruption_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ToothEruption_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ToothEruption_babyId_toothCode_key" ON "ToothEruption"("babyId", "toothCode");
CREATE INDEX "ToothEruption_healthRecordId_idx" ON "ToothEruption"("healthRecordId");
CREATE INDEX "ToothEruption_babyId_idx" ON "ToothEruption"("babyId");
