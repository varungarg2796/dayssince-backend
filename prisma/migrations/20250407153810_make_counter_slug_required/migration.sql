/*
  Warnings:

  - Made the column `slug` on table `counters` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "counters" ALTER COLUMN "slug" SET NOT NULL;
