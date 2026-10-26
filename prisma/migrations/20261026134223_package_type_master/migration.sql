-- CreateTable
CREATE TABLE "PackageType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageType_code_key" ON "PackageType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PackageType_name_key" ON "PackageType"("name");
