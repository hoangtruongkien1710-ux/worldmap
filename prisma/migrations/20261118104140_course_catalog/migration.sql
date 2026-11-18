-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('COURSE', 'SESSION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeeMode" ADD VALUE 'COURSE';
ALTER TYPE "FeeMode" ADD VALUE 'PER_SESSION';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "maxStudents" INTEGER,
ADD COLUMN     "totalSessions" INTEGER;

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2463eb',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "description" TEXT,
    "target" TEXT,
    "sessionsMin" INTEGER,
    "sessionsMax" INTEGER,
    "sessionsPerWeek" TEXT,
    "durationText" TEXT,
    "sessionHours" DECIMAL(3,1),
    "listedPrice" INTEGER NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL DEFAULT 'COURSE',
    "classSizeMin" INTEGER,
    "classSizeMax" INTEGER,
    "coursebook" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
