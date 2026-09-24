-- Critical fixes bundle: order token, cash shift, refund audit trail, discount endpoint hookup.
-- Idempotent guards so re-runs (or partially-applied states) don't error out.

-- 1. Order token (kills the by-number enumeration attack)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'orderToken'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "orderToken" TEXT;
    UPDATE "Order" SET "orderToken" = gen_random_uuid()::text WHERE "orderToken" IS NULL;
    ALTER TABLE "Order" ALTER COLUMN "orderToken" SET NOT NULL;
    CREATE UNIQUE INDEX "Order_orderToken_key" ON "Order"("orderToken");
  END IF;
END $$;

-- 2. Cash shift table
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashShift_openedById_fkey') THEN
    ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashShift_closedById_fkey') THEN
    ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Payment refund audit + cash shift link
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Payment' AND column_name='refundedPaymentId') THEN
    ALTER TABLE "Payment" ADD COLUMN "refundedPaymentId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Payment' AND column_name='approvedById') THEN
    ALTER TABLE "Payment" ADD COLUMN "approvedById" TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_refundedPaymentId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundedPaymentId_fkey" FOREIGN KEY ("refundedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_approvedById_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Payment_refundedPaymentId_idx" ON "Payment"("refundedPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_cashShiftId_idx" ON "Payment"("cashShiftId");
