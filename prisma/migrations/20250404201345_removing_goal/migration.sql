/*
  Warnings:

  - You are about to drop the column `goal_duration_unit` on the `counters` table. All the data in the column will be lost.
  - You are about to drop the column `goal_duration_value` on the `counters` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "counters" DROP COLUMN "goal_duration_unit",
DROP COLUMN "goal_duration_value";

-- DropEnum
DROP TYPE "DurationUnit";
