-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "classId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_classId_idx" ON "Payment"("classId");
