-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MenuItem_deletedAt_idx" ON "MenuItem"("deletedAt");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
