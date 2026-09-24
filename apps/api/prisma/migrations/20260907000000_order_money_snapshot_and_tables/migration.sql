-- DB-001b: Order money-snapshot + table-management columns never migrated.
-- Live has these out-of-band (same class as Payment); clean installs lack them.
-- Also creates Table / MergedGroup models that exist in schema.prisma but have
-- no migration on live or clean DBs (tables.service merge/unmerge needs them).

-- ── Order money snapshot (schema Phase 2) ──
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "itemsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountReason" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceRate" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "total" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacyBackfilled" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_discountedById_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_discountedById_fkey"
      FOREIGN KEY ("discountedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill money snapshot on clean DBs that had no prior rows (no-op when empty).
-- Live rows already have correct values; IF NOT EXISTS-style guarded update.
UPDATE "Order"
SET "itemsTotal" = "total",
    "paidTotal" = CASE WHEN "paymentStatus" = 'paid' THEN "total" ELSE 0 END
WHERE "itemsTotal" = 0 AND "total" > 0;

-- ── Table management (schema Table / MergedGroup) ──
CREATE TABLE IF NOT EXISTS "Table" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Table_number_key" ON "Table"("number");
CREATE INDEX IF NOT EXISTS "Table_number_idx" ON "Table"("number");
CREATE INDEX IF NOT EXISTS "Table_active_idx" ON "Table"("active");

CREATE TABLE IF NOT EXISTS "MergedGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "tableIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MergedGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "mergedGroupId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_tableId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey"
      FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_mergedGroupId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_mergedGroupId_fkey"
      FOREIGN KEY ("mergedGroupId") REFERENCES "MergedGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
