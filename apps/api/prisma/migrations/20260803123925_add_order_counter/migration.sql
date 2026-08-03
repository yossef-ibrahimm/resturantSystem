-- CreateTable
CREATE TABLE "OrderCounter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("id")
);

-- Seed the counter from the highest existing order number so new
-- orders continue from MAX(orderNumber)+1 without collisions.
INSERT INTO "OrderCounter" ("id", "value")
SELECT 'singleton', COALESCE(MAX(CAST("orderNumber" AS INTEGER)), 1000)
FROM "Order";
