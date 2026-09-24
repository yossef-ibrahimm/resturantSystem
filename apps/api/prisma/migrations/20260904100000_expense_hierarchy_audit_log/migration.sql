-- Expense Hierarchy + Audit Log migration
-- Written manually (not prisma diff) to preserve existing data

-- ============================================================
-- 1. Create MainExpenseCategory table
-- ============================================================
CREATE TABLE "MainExpenseCategory" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nameAr"      TEXT NOT NULL,
    "nameEn"      TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),

    CONSTRAINT "MainExpenseCategory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MainExpenseCategory_active_idx" ON "MainExpenseCategory"("active");
CREATE INDEX "MainExpenseCategory_deletedAt_idx" ON "MainExpenseCategory"("deletedAt");

-- ============================================================
-- 2. Create SubExpenseCategory table
-- ============================================================
CREATE TABLE "SubExpenseCategory" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
    "mainCategoryId" TEXT NOT NULL,
    "nameAr"         TEXT NOT NULL,
    "nameEn"         TEXT NOT NULL,
    "description"    TEXT NOT NULL DEFAULT '',
    "active"         BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "deletedAt"      TIMESTAMP(3),

    CONSTRAINT "SubExpenseCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SubExpenseCategory_mainCategoryId_fkey" FOREIGN KEY ("mainCategoryId")
        REFERENCES "MainExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SubExpenseCategory_mainCategoryId_idx" ON "SubExpenseCategory"("mainCategoryId");
CREATE INDEX "SubExpenseCategory_active_idx" ON "SubExpenseCategory"("active");
CREATE INDEX "SubExpenseCategory_deletedAt_idx" ON "SubExpenseCategory"("deletedAt");

-- ============================================================
-- 3. Seed default MainExpenseCategory
-- ============================================================
INSERT INTO "MainExpenseCategory" ("id", "nameAr", "nameEn", "description", "active", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'مصروفات ثابتة', 'Fixed Expenses', 'Expenses that recur regularly (rent, salaries, etc.)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'مصروفات متغيرة', 'Variable Expenses', 'Expenses that vary with business activity', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000003', 'مصروفات تشغيلية', 'Operational Expenses', 'Day-to-day operational costs', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- 4. Migrate existing ExpenseCategory → SubExpenseCategory
--    Map each existing category to the default "Operational" main category
-- ============================================================
INSERT INTO "SubExpenseCategory" ("id", "mainCategoryId", "nameAr", "nameEn", "active", "createdAt", "updatedAt")
SELECT
  ec."id",
  '00000000-0000-0000-0000-000000000003',  -- "Operational Expenses" as default parent
  ec."nameAr",
  ec."nameEn",
  ec."active",
  ec."createdAt",
  ec."updatedAt"
FROM "ExpenseCategory" ec;

-- ============================================================
-- 5. Add new columns to Expense table
-- ============================================================
-- Add subCategoryId (nullable initially for migration)
ALTER TABLE "Expense" ADD COLUMN "subCategoryId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "cashShiftId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);
-- recordedById already exists from original schema

-- ============================================================
-- 6. Migrate existing Expense data: map categoryId → subCategoryId
-- ============================================================
UPDATE "Expense" SET "subCategoryId" = "categoryId";

-- ============================================================
-- 7. Make subCategoryId NOT NULL and add FK constraint
-- ============================================================
ALTER TABLE "Expense" ALTER COLUMN "subCategoryId" SET NOT NULL;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_subCategoryId_fkey"
  FOREIGN KEY ("subCategoryId")
  REFERENCES "SubExpenseCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add FK for cashShiftId
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_cashShiftId_fkey"
  FOREIGN KEY ("cashShiftId")
  REFERENCES "CashShift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK for recordedById (column already exists, just add constraint)
DO $$ BEGIN
  ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_recordedById_fkey"
    FOREIGN KEY ("recordedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 8. Create indexes on new Expense columns
-- ============================================================
CREATE INDEX "Expense_subCategoryId_idx" ON "Expense"("subCategoryId");
CREATE INDEX "Expense_paymentMethod_idx" ON "Expense"("paymentMethod");
CREATE INDEX "Expense_cashShiftId_idx" ON "Expense"("cashShiftId");
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");
CREATE INDEX "Expense_recordedById_idx" ON "Expense"("recordedById");

-- ============================================================
-- 9. Drop old Expense → ExpenseCategory FK and columns
-- ============================================================
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "Expense" DROP COLUMN "categoryId";

-- Drop old ExpenseCategory table
DROP TABLE "ExpenseCategory";

-- ============================================================
-- 10. Add cashShiftVarianceThreshold to RestaurantSettings
-- ============================================================
ALTER TABLE "RestaurantSettings" ADD COLUMN "cashShiftVarianceThreshold" DECIMAL(10, 2) NOT NULL DEFAULT 50;

-- ============================================================
-- 11. Add expenses relation to CashShift (via FK on Expense)
--     (Already handled by the Expense_cashShiftId_fkey above)

-- ============================================================
-- 12. Create AuditLog table
-- ============================================================
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "action"     TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "userId"     TEXT,
    "beforeJson" JSONB,
    "afterJson"  JSONB,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
