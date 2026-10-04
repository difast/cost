
-- AlterTable
ALTER TABLE "Calculation" ADD COLUMN     "qualityState" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "addressDetails" JSONB;
