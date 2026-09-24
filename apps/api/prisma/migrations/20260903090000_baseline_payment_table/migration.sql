-- Baseline Payment table (DB-001).
-- No prior migration creates Payment; 20260903100000_critical_fixes_bundle
-- only ALTERs it and fails on an empty database with 42P01.
-- Named to sort BEFORE critical_fixes_bundle so clean installs work.
-- Fully idempotent so live DBs that already have Payment (out-of-band) stay valid.

-- CashShift is normally created in 20260903100000_critical_fixes_bundle, which
-- runs AFTER this migration. Create it here when missing so Payment FKs resolve
-- on a clean database; critical_fixes uses IF NOT EXISTS and stays a no-op.
CREATE TABLE IF NOT EXISTS "CashShift" (
    "id" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "closingFloat" DECIMAL(10,2),
    "expectedCash" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CashShift_status_idx" ON "CashShift"("status");
CREATE INDEX IF NOT EXISTS "CashShift_openedAt_idx" ON "CashShift"("openedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashShift_openedById_fkey') THEN
    ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_openedById_fkey"
      FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashShift_closedById_fkey') THEN
    ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'wallet', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "actorId" TEXT,
    "cashShiftId" TEXT,
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "refundedPaymentId" TEXT,
    "approvedById" TEXT,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Live out-of-band Payment may lack later columns (e.g. idempotencyKey).
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cashShiftId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key"
  ON "Payment"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_method_paidAt_idx" ON "Payment"("method", "paidAt");
CREATE INDEX IF NOT EXISTS "Payment_refundedPaymentId_idx" ON "Payment"("refundedPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_cashShiftId_idx" ON "Payment"("cashShiftId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_orderId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_actorId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_cashShiftId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashShiftId_fkey"
      FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_refundedPaymentId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundedPaymentId_fkey"
      FOREIGN KEY ("refundedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_approvedById_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
