-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'appraiser',
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "ogrn" TEXT,
    "kpp" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appraiser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "postalAddress" TEXT,
    "education" TEXT,
    "experienceYears" INTEGER,
    "sroName" TEXT,
    "sroRegistryNumber" TEXT,
    "sroMembershipDate" TIMESTAMP(3),
    "sroAddress" TEXT,
    "qualificationCertNumber" TEXT,
    "qualificationCertDate" TIMESTAMP(3),
    "qualificationCertValidUntil" TIMESTAMP(3),
    "qualificationArea" TEXT DEFAULT 'Оценка недвижимости',
    "insuranceCompany" TEXT,
    "insurancePolicyNumber" TEXT,
    "insuranceSum" DECIMAL(18,2),
    "insuranceValidFrom" TIMESTAMP(3),
    "insuranceValidUntil" TIMESTAMP(3),
    "legalEntityName" TEXT,
    "legalEntityInn" TEXT,
    "legalEntityOgrn" TEXT,
    "legalEntityAddress" TEXT,
    "legalEntityInsuranceCompany" TEXT,
    "legalEntityInsurancePolicy" TEXT,
    "legalEntityInsuranceSum" DECIMAL(18,2),
    "legalEntityInsuranceValidUntil" TIMESTAMP(3),
    "bankDetails" TEXT,
    "signatureFileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appraiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "propertyType" TEXT NOT NULL DEFAULT 'apartment',
    "approach" TEXT NOT NULL DEFAULT 'comparative',
    "customerName" TEXT,
    "customerDetails" TEXT,
    "basis" TEXT,
    "contractNumber" TEXT,
    "contractDate" TIMESTAMP(3),
    "purpose" TEXT,
    "intendedUse" TEXT,
    "valueType" TEXT DEFAULT 'Рыночная стоимость',
    "rightsAssessed" TEXT DEFAULT 'Право собственности',
    "valuationDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "assumptions" TEXT,
    "limitingConditions" TEXT,
    "marketAnalysis" TEXT,
    "adjustmentSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL DEFAULT 'Квартира',
    "address" TEXT,
    "fiasId" TEXT,
    "cadastralNumber" TEXT,
    "area" DECIMAL(12,2),
    "livingArea" DECIMAL(12,2),
    "kitchenArea" DECIMAL(12,2),
    "purpose" TEXT DEFAULT 'Жилое',
    "rights" TEXT DEFAULT 'Собственность',
    "rightHolders" TEXT,
    "encumbrances" TEXT,
    "rooms" INTEGER,
    "floor" INTEGER,
    "ceilingHeight" DECIMAL(5,2),
    "finishing" TEXT,
    "condition" TEXT,
    "furniture" BOOLEAN,
    "balcony" TEXT,
    "bathroom" TEXT,
    "communications" TEXT,
    "metroName" TEXT,
    "metroDistanceM" INTEGER,
    "district" TEXT,
    "description" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "cadastralNumber" TEXT,
    "yearBuilt" INTEGER,
    "floors" INTEGER,
    "wallMaterial" TEXT,
    "series" TEXT,
    "houseCondition" TEXT,
    "elevators" TEXT,
    "parking" TEXT,
    "overhaulYear" INTEGER,
    "description" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparable" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "sourceKind" TEXT NOT NULL DEFAULT 'manual',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "offerDate" TIMESTAMP(3),
    "address" TEXT,
    "price" DECIMAL(18,2) NOT NULL,
    "area" DECIMAL(12,2) NOT NULL,
    "rooms" INTEGER,
    "floor" INTEGER,
    "floors" INTEGER,
    "wallMaterial" TEXT,
    "yearBuilt" INTEGER,
    "finishing" TEXT,
    "furniture" BOOLEAN,
    "houseCondition" TEXT,
    "metroDistanceM" INTEGER,
    "rights" TEXT DEFAULT 'Собственность',
    "description" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "screenshotFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "comparableId" TEXT NOT NULL,
    "factorCode" TEXT NOT NULL,
    "factorName" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 2,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "subjectValue" TEXT,
    "comparableValue" TEXT,
    "suggestedValue" DECIMAL(10,6),
    "value" DECIMAL(10,6) NOT NULL,
    "minValue" DECIMAL(10,6),
    "maxValue" DECIMAL(10,6),
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "ruleSnapshot" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "edition" TEXT NOT NULL,
    "actualDate" TIMESTAMP(3),
    "segment" TEXT NOT NULL DEFAULT 'apartment',
    "licenseType" TEXT NOT NULL DEFAULT 'own',
    "licenseNote" TEXT,
    "url" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjustmentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentFactor" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "attribute" TEXT,
    "stage" INTEGER NOT NULL DEFAULT 2,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(10,6),
    "minValue" DECIMAL(10,6),
    "maxValue" DECIMAL(10,6),
    "params" JSONB NOT NULL DEFAULT '{}',
    "reference" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AdjustmentFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentCategory" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "coefficient" DECIMAL(10,6) NOT NULL,
    "minCoefficient" DECIMAL(10,6),
    "maxCoefficient" DECIMAL(10,6),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdjustmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT,
    "extracted" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketData" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT,
    "region" TEXT,
    "segment" TEXT,
    "indicator" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "unit" TEXT,
    "period" TEXT,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormativeDocument" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "adoptedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "url" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licenseNote" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationVersion" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'apartment',
    "approach" TEXT NOT NULL DEFAULT 'comparative',
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "calculationVersionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentEvent" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Appraiser_userId_key" ON "Appraiser"("userId");

-- CreateIndex
CREATE INDEX "Assessment_ownerId_updatedAt_idx" ON "Assessment"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_assessmentId_key" ON "Property"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_assessmentId_key" ON "Building"("assessmentId");

-- CreateIndex
CREATE INDEX "Comparable_assessmentId_position_idx" ON "Comparable"("assessmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Adjustment_comparableId_factorCode_key" ON "Adjustment"("comparableId", "factorCode");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentSource_code_edition_key" ON "AdjustmentSource"("code", "edition");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentFactor_sourceId_code_key" ON "AdjustmentFactor"("sourceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentCategory_factorId_code_key" ON "AdjustmentCategory"("factorId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Calculation_assessmentId_key" ON "Calculation"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CalculationVersion_calculationId_versionNumber_key" ON "CalculationVersion"("calculationId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_code_version_key" ON "ReportTemplate"("code", "version");

-- CreateIndex
CREATE INDEX "AssessmentEvent_assessmentId_createdAt_idx" ON "AssessmentEvent"("assessmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appraiser" ADD CONSTRAINT "Appraiser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_adjustmentSourceId_fkey" FOREIGN KEY ("adjustmentSourceId") REFERENCES "AdjustmentSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparable" ADD CONSTRAINT "Comparable_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_comparableId_fkey" FOREIGN KEY ("comparableId") REFERENCES "Comparable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentFactor" ADD CONSTRAINT "AdjustmentFactor_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AdjustmentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentCategory" ADD CONSTRAINT "AdjustmentCategory_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "AdjustmentFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketData" ADD CONSTRAINT "MarketData_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationVersion" ADD CONSTRAINT "CalculationVersion_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_calculationVersionId_fkey" FOREIGN KEY ("calculationVersionId") REFERENCES "CalculationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEvent" ADD CONSTRAINT "AssessmentEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEvent" ADD CONSTRAINT "AssessmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
