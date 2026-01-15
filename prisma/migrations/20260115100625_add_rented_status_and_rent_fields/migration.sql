-- AlterEnum
ALTER TYPE "ItemStatus" ADD VALUE 'RENTED';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "autoReopenAt" TIMESTAMP(3),
ADD COLUMN     "rentDurationMonths" INTEGER,
ADD COLUMN     "rentEndDate" TIMESTAMP(3),
ADD COLUMN     "rentStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "isRental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentalEndDate" TIMESTAMP(3),
ADD COLUMN     "rentalMonths" INTEGER,
ADD COLUMN     "rentalStartDate" TIMESTAMP(3);
