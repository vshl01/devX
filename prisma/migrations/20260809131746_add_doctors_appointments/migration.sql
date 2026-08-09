-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "patientPhone" TEXT;

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT,
    "languages" TEXT[],
    "workingHours" JSONB NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prescription_patientPhone_idx" ON "Prescription"("patientPhone");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_date_idx" ON "Appointment"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_doctorId_date_startTime_key" ON "Appointment"("doctorId", "date", "startTime");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the demo doctor
INSERT INTO "Doctor" ("id", "name", "specialization", "languages", "workingHours") VALUES (
  gen_random_uuid(),
  'Dr. Ananya Sharma',
  'General Physician',
  ARRAY['en-IN', 'hi-IN', 'kn-IN'],
  '[
    {"day": "mon", "windows": [["09:00", "13:00"], ["17:00", "21:00"]]},
    {"day": "tue", "windows": [["09:00", "13:00"], ["17:00", "21:00"]]},
    {"day": "wed", "windows": [["09:00", "13:00"], ["17:00", "21:00"]]},
    {"day": "thu", "windows": [["09:00", "13:00"], ["17:00", "21:00"]]},
    {"day": "fri", "windows": [["09:00", "13:00"], ["17:00", "21:00"]]},
    {"day": "sat", "windows": [["09:00", "13:00"]]}
  ]'::jsonb
);
