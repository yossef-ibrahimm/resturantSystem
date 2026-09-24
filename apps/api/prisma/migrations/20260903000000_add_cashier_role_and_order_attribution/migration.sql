-- Add cashier role
ALTER TYPE "Role" ADD VALUE 'cashier';

-- Add order actor attribution
ALTER TABLE "Order" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
