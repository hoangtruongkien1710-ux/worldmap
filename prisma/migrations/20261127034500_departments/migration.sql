-- CreateTable
CREATE TABLE "Department" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costAccount" TEXT NOT NULL DEFAULT '6422',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- Bộ phận có sẵn (mã khớp giá trị cũ của Employee.department)
INSERT INTO "Department" ("code", "name", "costAccount", "order") VALUES
  ('GIAO_VIEN', 'Giáo viên', '632', 1),
  ('VAN_PHONG', 'Văn phòng', '6422', 2);
