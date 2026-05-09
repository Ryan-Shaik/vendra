/*
  Warnings:

  - You are about to drop the column `scopeId` on the `CommissionConfig` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CommissionConfig_scope_scopeId_idx";

-- AlterTable
ALTER TABLE "CommissionConfig" DROP COLUMN "scopeId",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "CommissionConfig_scope_idx" ON "CommissionConfig"("scope");

-- CreateIndex
CREATE INDEX "CommissionConfig_vendorId_idx" ON "CommissionConfig"("vendorId");

-- CreateIndex
CREATE INDEX "CommissionConfig_categoryId_idx" ON "CommissionConfig"("categoryId");

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add check constraint
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_scope_check" CHECK (
  ("scope" = 'global' AND "vendorId" IS NULL AND "categoryId" IS NULL) OR
  ("scope" = 'vendor' AND "vendorId" IS NOT NULL) OR
  ("scope" = 'category' AND "categoryId" IS NOT NULL)
);
