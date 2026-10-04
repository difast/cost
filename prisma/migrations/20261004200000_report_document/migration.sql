-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "documentVersionId" TEXT;

-- CreateTable
CREATE TABLE "ReportDocument" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDocumentVersion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "calculationVersionId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "rendered" JSONB NOT NULL,
    "docxFileId" TEXT,
    "pdfFileId" TEXT,
    "xlsxFileId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDocument_assessmentId_key" ON "ReportDocument"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDocumentVersion_assessmentId_versionNumber_key" ON "ReportDocumentVersion"("assessmentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "ReportDocument" ADD CONSTRAINT "ReportDocument_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocumentVersion" ADD CONSTRAINT "ReportDocumentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocumentVersion" ADD CONSTRAINT "ReportDocumentVersion_calculationVersionId_fkey" FOREIGN KEY ("calculationVersionId") REFERENCES "CalculationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
