-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "calendarEventId" TEXT;

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleCalendarId" TEXT DEFAULT 'primary',
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiry" TIMESTAMP(3);
