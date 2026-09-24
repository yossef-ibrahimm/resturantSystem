-- DB-002: RestaurantSettings columns never migrated on clean installs:
--   - table management (totalTables, tableNumberStart, tableNumberEnd, staleThresholdMinutes)
--   - tax/service (taxEnabled, taxRate, serviceEnabled, serviceRate) — present on live only out-of-band
--   - cashShiftVarianceThreshold safety net (primary add is in expense_hierarchy migration)
-- DB-005: at most one open CashShift (partial unique index).
-- Idempotent for live DBs that already have some of these objects.

ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "serviceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "serviceRate" DECIMAL(5,4) NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "totalTables" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "tableNumberStart" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "tableNumberEnd" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "staleThresholdMinutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "RestaurantSettings"
  ADD COLUMN IF NOT EXISTS "cashShiftVarianceThreshold" DECIMAL(10,2) NOT NULL DEFAULT 50;

-- DB-005: single-drawer policy enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "CashShift_one_open_idx"
  ON "CashShift"("id") WHERE "status" = 'open';
