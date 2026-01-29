/*
  Warnings:

  - Made the column `vaStage` on table `chats` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "chats" ALTER COLUMN "vaStage" SET NOT NULL;
