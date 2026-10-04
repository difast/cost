-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "infrastructure" JSONB,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);
