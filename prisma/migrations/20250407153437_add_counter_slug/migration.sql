/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `counters` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "counters" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "counters_slug_key" ON "counters"("slug");
