-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'ACTIVE', 'PAYMENT_RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'SYSTEM', 'ADMIN_NOTIFICATION', 'AGENT_NOTIFICATION');

-- CreateEnum
CREATE TYPE "AgentActionType" AS ENUM ('CHAT_ASSIGNED', 'MESSAGE_SENT', 'MESSAGE_READ', 'FIRST_RESPONSE', 'CALL_INITIATED', 'CALL_ENDED', 'PAYMENT_CONFIRMED', 'CHAT_CLOSED');

-- CreateEnum
CREATE TYPE "AgentPaymentStatus" AS ENUM ('PENDING', 'PAYMENT_RECEIVED', 'AGENT_PAID', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "UserRatingCategory" AS ENUM ('RESPONSIVENESS', 'PROFESSIONALISM', 'HELPFULNESS', 'KNOWLEDGE', 'TRUSTWORTHINESS', 'OVERALL');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('UNPROFESSIONAL_CONDUCT', 'UNRESPONSIVE', 'MISLEADING_INFORMATION', 'FRAUD_ATTEMPT', 'OTHER');

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAgentResponseAt" TIMESTAMP(3),
    "lastAgentResponseAt" TIMESTAMP(3),
    "agentResponseCount" INTEGER NOT NULL DEFAULT 0,
    "userMessageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUserMessageAt" TIMESTAMP(3),
    "averageResponseTimeMinutes" INTEGER,
    "wasAgentResponsive" BOOLEAN NOT NULL DEFAULT false,
    "agentMissedFirstResponse" BOOLEAN NOT NULL DEFAULT false,
    "paymentReceivedAt" TIMESTAMP(3),
    "agentPaymentStatus" "AgentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "agentFeeAmount" DOUBLE PRECISION,
    "agentFeePercentage" DOUBLE PRECISION,
    "agentPaymentAccountDetails" JSONB,
    "agentPaidAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByAdminId" UUID,
    "closureReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages_model" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ratings" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "responsivenessRating" INTEGER,
    "professionalismRating" INTEGER,
    "helpfulnessRating" INTEGER,
    "knowledgeRating" INTEGER,
    "trustworthinessRating" INTEGER,
    "overallRating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "tipAmount" DOUBLE PRECISION,
    "tipPaid" BOOLEAN NOT NULL DEFAULT false,
    "tipPaidAt" TIMESTAMP(3),
    "adminRequestedRating" BOOLEAN NOT NULL DEFAULT false,
    "adminRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_statistics" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "totalChatsAssigned" INTEGER NOT NULL DEFAULT 0,
    "totalChatsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalChatsCancelled" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTimeMinutes" INTEGER,
    "responsesWithin24Hours" INTEGER NOT NULL DEFAULT 0,
    "responsesAfter24Hours" INTEGER NOT NULL DEFAULT 0,
    "averageOverallRating" DOUBLE PRECISION,
    "averageResponsivenessRating" DOUBLE PRECISION,
    "averageProfessionalismRating" DOUBLE PRECISION,
    "averageHelpfulnessRating" DOUBLE PRECISION,
    "totalRatingsReceived" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTipsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isWarned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_activity_logs" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "actionType" "AgentActionType" NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_reports" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reportedAgentId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT NOT NULL,
    "reviewedByAdminId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_fee_payments" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "AgentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "userPaymentConfirmedAt" TIMESTAMP(3),
    "agentPaymentConfirmedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chats_userId_idx" ON "chats"("userId");

-- CreateIndex
CREATE INDEX "chats_agentId_idx" ON "chats"("agentId");

-- CreateIndex
CREATE INDEX "chats_propertyId_idx" ON "chats"("propertyId");

-- CreateIndex
CREATE INDEX "chats_status_idx" ON "chats"("status");

-- CreateIndex
CREATE INDEX "chats_createdAt_idx" ON "chats"("createdAt");

-- CreateIndex
CREATE INDEX "chats_paymentReceivedAt_idx" ON "chats"("paymentReceivedAt");

-- CreateIndex
CREATE INDEX "chat_messages_model_chatId_idx" ON "chat_messages_model"("chatId");

-- CreateIndex
CREATE INDEX "chat_messages_model_senderId_idx" ON "chat_messages_model"("senderId");

-- CreateIndex
CREATE INDEX "chat_messages_model_createdAt_idx" ON "chat_messages_model"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_ratings_chatId_key" ON "user_ratings"("chatId");

-- CreateIndex
CREATE INDEX "user_ratings_chatId_idx" ON "user_ratings"("chatId");

-- CreateIndex
CREATE INDEX "user_ratings_userId_idx" ON "user_ratings"("userId");

-- CreateIndex
CREATE INDEX "user_ratings_agentId_idx" ON "user_ratings"("agentId");

-- CreateIndex
CREATE INDEX "user_ratings_overallRating_idx" ON "user_ratings"("overallRating");

-- CreateIndex
CREATE UNIQUE INDEX "agent_statistics_agentId_key" ON "agent_statistics"("agentId");

-- CreateIndex
CREATE INDEX "agent_statistics_agentId_idx" ON "agent_statistics"("agentId");

-- CreateIndex
CREATE INDEX "agent_statistics_averageOverallRating_idx" ON "agent_statistics"("averageOverallRating");

-- CreateIndex
CREATE INDEX "agent_activity_logs_chatId_idx" ON "agent_activity_logs"("chatId");

-- CreateIndex
CREATE INDEX "agent_activity_logs_agentId_idx" ON "agent_activity_logs"("agentId");

-- CreateIndex
CREATE INDEX "agent_activity_logs_actionType_idx" ON "agent_activity_logs"("actionType");

-- CreateIndex
CREATE INDEX "agent_activity_logs_createdAt_idx" ON "agent_activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "conversation_reports_chatId_idx" ON "conversation_reports"("chatId");

-- CreateIndex
CREATE INDEX "conversation_reports_userId_idx" ON "conversation_reports"("userId");

-- CreateIndex
CREATE INDEX "conversation_reports_reportedAgentId_idx" ON "conversation_reports"("reportedAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_fee_payments_chatId_key" ON "agent_fee_payments"("chatId");

-- CreateIndex
CREATE INDEX "agent_fee_payments_chatId_idx" ON "agent_fee_payments"("chatId");

-- CreateIndex
CREATE INDEX "agent_fee_payments_agentId_idx" ON "agent_fee_payments"("agentId");

-- CreateIndex
CREATE INDEX "agent_fee_payments_status_idx" ON "agent_fee_payments"("status");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_closedByAdminId_fkey" FOREIGN KEY ("closedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages_model" ADD CONSTRAINT "chat_messages_model_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages_model" ADD CONSTRAINT "chat_messages_model_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_statistics" ADD CONSTRAINT "agent_statistics_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity_logs" ADD CONSTRAINT "agent_activity_logs_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity_logs" ADD CONSTRAINT "agent_activity_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reportedAgentId_fkey" FOREIGN KEY ("reportedAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_fee_payments" ADD CONSTRAINT "agent_fee_payments_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_fee_payments" ADD CONSTRAINT "agent_fee_payments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
