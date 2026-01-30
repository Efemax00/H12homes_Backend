/*
  Warnings:

  - You are about to drop the column `attachmentUrl` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `receiverId` on the `chat_messages` table. All the data in the column will be lost.
  - The `messageType` column on the `chat_messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `agentFeeAmount` on the `reservation_fee_payments` table. All the data in the column will be lost.
  - You are about to drop the column `agentFeePaidAt` on the `reservation_fee_payments` table. All the data in the column will be lost.
  - You are about to drop the `chat_messages_model` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[chatId]` on the table `reservation_fee_payments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('USER', 'AI_AGENT', 'REAL_AGENT', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages_model" DROP CONSTRAINT "chat_messages_model_chatId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages_model" DROP CONSTRAINT "chat_messages_model_senderId_fkey";

-- DropIndex
DROP INDEX "chat_messages_propertyId_idx";

-- DropIndex
DROP INDEX "chat_messages_receiverId_idx";

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "attachmentUrl",
DROP COLUMN "isRead",
DROP COLUMN "propertyId",
DROP COLUMN "receiverId",
ADD COLUMN     "aiConfidenceScore" DOUBLE PRECISION,
ADD COLUMN     "aiResponseId" TEXT,
ADD COLUMN     "chatId" UUID,
ADD COLUMN     "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "senderType" "ChatSenderType" NOT NULL DEFAULT 'USER',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "senderId" DROP NOT NULL,
DROP COLUMN "messageType",
ADD COLUMN     "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "agentFirstMessageAt" TIMESTAMP(3),
ADD COLUMN     "agentLastMessageAt" TIMESTAMP(3),
ADD COLUMN     "agentMessageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "agentPhaseStartedAt" TIMESTAMP(3),
ADD COLUMN     "aiConversationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiPhaseEndedAt" TIMESTAMP(3),
ADD COLUMN     "aiPhaseStartedAt" TIMESTAMP(3),
ADD COLUMN     "aiUnlockKeywordUsed" TEXT,
ADD COLUMN     "isReservationExpired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservationExpiredAt" TIMESTAMP(3),
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "reservationFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
ADD COLUMN     "reservationFeePaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reservation_fee_payments" DROP COLUMN "agentFeeAmount",
DROP COLUMN "agentFeePaidAt",
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "agentCommissionAmount" DOUBLE PRECISION,
ADD COLUMN     "agentCommissionPaidAt" TIMESTAMP(3),
ADD COLUMN     "assignedAgentId" UUID,
ADD COLUMN     "chatId" UUID,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedByAdminId" UUID,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isExpired" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "h12KeepsAmount" SET DEFAULT 10000;

-- DropTable
DROP TABLE "chat_messages_model";

-- CreateTable
CREATE TABLE "ai_responses" (
    "id" UUID NOT NULL,
    "responseType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keyword" TEXT,
    "propertyType" TEXT,
    "category" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_chat_messages" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_responses_responseType_idx" ON "ai_responses"("responseType");

-- CreateIndex
CREATE INDEX "ai_responses_isActive_idx" ON "ai_responses"("isActive");

-- CreateIndex
CREATE INDEX "property_chat_messages_propertyId_idx" ON "property_chat_messages"("propertyId");

-- CreateIndex
CREATE INDEX "property_chat_messages_senderId_idx" ON "property_chat_messages"("senderId");

-- CreateIndex
CREATE INDEX "property_chat_messages_receiverId_idx" ON "property_chat_messages"("receiverId");

-- CreateIndex
CREATE INDEX "property_chat_messages_createdAt_idx" ON "property_chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_chatId_idx" ON "chat_messages"("chatId");

-- CreateIndex
CREATE INDEX "chat_messages_senderType_idx" ON "chat_messages"("senderType");

-- CreateIndex
CREATE INDEX "chats_reservationExpiresAt_idx" ON "chats"("reservationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_fee_payments_chatId_key" ON "reservation_fee_payments"("chatId");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_chatId_idx" ON "reservation_fee_payments"("chatId");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_assignedAgentId_idx" ON "reservation_fee_payments"("assignedAgentId");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_expiresAt_idx" ON "reservation_fee_payments"("expiresAt");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_chat_messages" ADD CONSTRAINT "property_chat_messages_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_chat_messages" ADD CONSTRAINT "property_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_chat_messages" ADD CONSTRAINT "property_chat_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_fee_payments" ADD CONSTRAINT "reservation_fee_payments_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_fee_payments" ADD CONSTRAINT "reservation_fee_payments_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_fee_payments" ADD CONSTRAINT "reservation_fee_payments_confirmedByAdminId_fkey" FOREIGN KEY ("confirmedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
