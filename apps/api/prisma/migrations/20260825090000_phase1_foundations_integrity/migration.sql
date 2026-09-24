-- Phase 1: Foundations & Integrity
-- Enums, Decimal money, per-stage audit columns.
-- Written manually (not prisma diff) to preserve existing data:
--   status/role are converted IN PLACE with USING casts instead of drop+recreate.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'kitchen_staff', 'waiter');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('received', 'preparing', 'ready', 'completed', 'cancelled');

-- Normalize any unexpected legacy values before casting (defensive)
UPDATE "Order" SET "status" = 'received'
WHERE "status" NOT IN ('received', 'preparing', 'ready', 'completed');

UPDATE "User" SET "role" = 'kitchen_staff'
WHERE "role" NOT IN ('admin', 'kitchen_staff', 'waiter');

-- Convert money columns from DoublePrecision to Decimal(10,2)
ALTER TABLE "MenuItem" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "MenuItemVariant" ALTER COLUMN "priceAdjust" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(10,2);

-- Convert status/role to enums IN PLACE (preserves values)
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus");
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'received';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'kitchen_staff';

-- Stage audit trail columns on Order
ALTER TABLE "Order" ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "preparingById" TEXT,
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "readyById" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "cancelReason" TEXT;

-- ForeignKey additions (SET NULL so deleting a user never blocks order history)
ALTER TABLE "Order" ADD CONSTRAINT "Order_preparingById_fkey" FOREIGN KEY ("preparingById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_readyById_fkey" FOREIGN KEY ("readyById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index hygiene: add hot-path createdAt index, drop redundant orderNumber dup of @unique
DROP INDEX "Order_orderNumber_idx";
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
