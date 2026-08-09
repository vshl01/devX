-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('CREATED', 'UPLOADING', 'DIGITISING', 'EXTRACTING', 'TRANSLATING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "originalFileReference" TEXT NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'CREATED',
    "sarvamJobId" TEXT,
    "sarvamExtractJobId" TEXT,
    "rawDigitisedText" TEXT,
    "rawDigitisedJson" JSONB,
    "structuredData" JSONB,
    "originalLanguage" TEXT,
    "targetLanguage" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionTranslation" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "translatedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescriptionTranslation_prescriptionId_idx" ON "PrescriptionTranslation"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionTranslation_prescriptionId_targetLanguage_key" ON "PrescriptionTranslation"("prescriptionId", "targetLanguage");

-- AddForeignKey
ALTER TABLE "PrescriptionTranslation" ADD CONSTRAINT "PrescriptionTranslation_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
