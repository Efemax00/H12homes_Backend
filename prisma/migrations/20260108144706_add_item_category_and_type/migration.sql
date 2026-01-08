-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('FOR_SALE', 'FOR_RENT', 'SHORT_STAY');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('HOUSE', 'HOUSEHOLD_ITEM');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "category" "ItemCategory" NOT NULL DEFAULT 'FOR_SALE',
ADD COLUMN     "itemType" "ItemType" NOT NULL DEFAULT 'HOUSE';
