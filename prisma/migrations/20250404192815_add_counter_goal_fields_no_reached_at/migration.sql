-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- AlterTable
ALTER TABLE "counters" ADD COLUMN     "goal_duration_unit" "DurationUnit",
ADD COLUMN     "goal_duration_value" INTEGER;
