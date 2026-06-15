-- Persist login and recovery rate-limit counters across application restarts.
CREATE TABLE "RateLimitAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "RateLimitAttempt_identifier_type_key" ON "RateLimitAttempt"("identifier", "type");
CREATE INDEX "RateLimitAttempt_identifier_idx" ON "RateLimitAttempt"("identifier");
CREATE INDEX "RateLimitAttempt_lockedUntil_idx" ON "RateLimitAttempt"("lockedUntil");
