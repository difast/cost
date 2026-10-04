-- AlterTable
ALTER TABLE "Adjustment" ADD COLUMN     "basisSnapshot" JSONB,
ADD COLUMN     "notRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overriddenAt" TIMESTAMP(3),
ADD COLUMN     "overriddenById" TEXT;

-- AlterTable
ALTER TABLE "AdjustmentFactor" ADD COLUMN     "actualDate" TIMESTAMP(3),
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "methodology" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Comparable" ADD COLUMN     "city" TEXT,
ADD COLUMN     "distanceM" INTEGER,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "houseType" TEXT,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "normalized" JSONB,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "provenance" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'use';

-- CreateTable
CREATE TABLE "ListingSearch" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "total" INTEGER,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarImport" (
    "id" TEXT NOT NULL,
    "archive" TEXT NOT NULL,
    "region" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "rows" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GarImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarAddrObj" (
    "objectId" BIGINT NOT NULL,
    "guid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "regionCode" INTEGER NOT NULL,

    CONSTRAINT "GarAddrObj_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "GarHouse" (
    "objectId" BIGINT NOT NULL,
    "guid" TEXT NOT NULL,
    "houseNum" TEXT,
    "addNum1" TEXT,
    "addNum2" TEXT,
    "houseType" INTEGER,
    "addType1" INTEGER,
    "addType2" INTEGER,
    "label" TEXT,
    "regionCode" INTEGER NOT NULL,

    CONSTRAINT "GarHouse_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "GarHierarchy" (
    "objectId" BIGINT NOT NULL,
    "parentObjId" BIGINT,
    "path" TEXT NOT NULL,
    "oktmo" TEXT,
    "regionCode" INTEGER NOT NULL,

    CONSTRAINT "GarHierarchy_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "GarAddress" (
    "objectId" BIGINT NOT NULL,
    "guid" TEXT NOT NULL,
    "regionCode" INTEGER NOT NULL,
    "region" TEXT,
    "municipality" TEXT,
    "locality" TEXT,
    "street" TEXT,
    "house" TEXT,
    "fullAddress" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,

    CONSTRAINT "GarAddress_pkey" PRIMARY KEY ("objectId")
);

-- CreateTable
CREATE TABLE "RosstatFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "structure" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'analyzed',
    "rows" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosstatFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosstatSeries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "RosstatSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosstatValue" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "regionCode" TEXT,
    "regionName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "fileId" TEXT NOT NULL,
    "actualDate" TIMESTAMP(3),

    CONSTRAINT "RosstatValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingSearch_assessmentId_createdAt_idx" ON "ListingSearch"("assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingSearch_provider_queryHash_idx" ON "ListingSearch"("provider", "queryHash");

-- CreateIndex
CREATE INDEX "GarAddrObj_regionCode_level_idx" ON "GarAddrObj"("regionCode", "level");

-- CreateIndex
CREATE INDEX "GarHouse_regionCode_idx" ON "GarHouse"("regionCode");

-- CreateIndex
CREATE INDEX "GarHierarchy_regionCode_idx" ON "GarHierarchy"("regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "GarAddress_guid_key" ON "GarAddress"("guid");

-- CreateIndex
CREATE INDEX "GarAddress_regionCode_idx" ON "GarAddress"("regionCode");

-- CreateIndex
CREATE INDEX "GarAddress_municipality_idx" ON "GarAddress"("municipality");

-- CreateIndex
CREATE INDEX "GarAddress_locality_idx" ON "GarAddress"("locality");

-- CreateIndex
CREATE INDEX "GarAddress_street_idx" ON "GarAddress"("street");

-- CreateIndex
CREATE INDEX "GarAddress_house_idx" ON "GarAddress"("house");

-- CreateIndex
CREATE UNIQUE INDEX "RosstatFile_sha256_key" ON "RosstatFile"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "RosstatSeries_code_key" ON "RosstatSeries"("code");

-- CreateIndex
CREATE INDEX "RosstatValue_regionName_period_idx" ON "RosstatValue"("regionName", "period");

-- CreateIndex
CREATE UNIQUE INDEX "RosstatValue_seriesId_regionName_period_key" ON "RosstatValue"("seriesId", "regionName", "period");

-- CreateIndex
CREATE INDEX "Comparable_assessmentId_provider_externalId_idx" ON "Comparable"("assessmentId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "ListingSearch" ADD CONSTRAINT "ListingSearch_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosstatValue" ADD CONSTRAINT "RosstatValue_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RosstatSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosstatValue" ADD CONSTRAINT "RosstatValue_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "RosstatFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Статус существующих аналогов из флага included
UPDATE "Comparable" SET "status" = CASE WHEN "included" THEN 'use' ELSE 'exclude' END;

-- Поиск адресов ГАР: полнотекстовый (встроенный GIN, без расширений) и по префиксу нормализованной строки
CREATE INDEX "GarAddress_normalized_fts_idx" ON "GarAddress" USING GIN (to_tsvector('simple', "normalized"));
CREATE INDEX "GarAddress_normalized_prefix_idx" ON "GarAddress" ("normalized" text_pattern_ops);
