-- CreateEnum
CREATE TYPE "HouseholdItemType" AS ENUM ('STOCK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HouseholdItemStatus" AS ENUM ('AVAILABLE', 'DELISTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HouseholdItemOrderStatus" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'AGENT_CONTACTED', 'AGENT_MEETING_SCHEDULED', 'AGENT_VERIFICATION_PENDING', 'PRODUCTION_IN_PROGRESS', 'AWAITING_FINAL_PHOTOS', 'FINAL_PHOTOS_APPROVED', 'AWAITING_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CustomProductionStatus" AS ENUM ('NOT_STARTED', 'MATERIALS_SOURCING', 'FRAME_ASSEMBLY', 'UPHOLSTERY_WORK', 'QUALITY_CHECK', 'FINAL_PHOTOS_READY', 'READY_FOR_DELIVERY');

-- CreateEnum
CREATE TYPE "CustomPhotoApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'CHANGES_COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockDeliveryStatus" AS ENUM ('AWAITING_AGENT_VERIFICATION', 'AGENT_VERIFIED', 'READY_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VAChatStatus" AS ENUM ('ACTIVE', 'AWAITING_PAYMENT', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "VAChatSenderType" AS ENUM ('USER', 'VIRTUAL_ASSISTANT');

-- CreateEnum
CREATE TYPE "VAChatMessageType" AS ENUM ('TEXT', 'SYSTEM_MESSAGE', 'CUSTOMIZATION_OPTIONS', 'PAYMENT_CONFIRMATION', 'FINAL_CONFIRMATION');

-- CreateEnum
CREATE TYPE "ReservationFeeStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "agentViewingApproved" BOOLEAN,
ADD COLUMN     "agentViewingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "agentViewingScheduledAt" TIMESTAMP(3),
ADD COLUMN     "currentReservationBy" UUID,
ADD COLUMN     "isReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "reservationFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
ADD COLUMN     "reservationFeePaidAt" TIMESTAMP(3),
ADD COLUMN     "reservationFeeStatus" "ReservationFeeStatus",
ADD COLUMN     "reservationRefundReason" TEXT,
ADD COLUMN     "reservationRefundedAt" TIMESTAMP(3),
ADD COLUMN     "reservationStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFurnitureMaker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInventor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HouseholdItem" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "type" "HouseholdItemType" NOT NULL DEFAULT 'STOCK',
    "status" "HouseholdItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "productionDaysMin" INTEGER,
    "productionDaysMax" INTEGER,
    "customizationOptions" JSONB,
    "sellerId" UUID NOT NULL,
    "createdBy" UUID,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdItemImage" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemId" UUID NOT NULL,

    CONSTRAINT "HouseholdItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_item_orders" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "assignedAgentId" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "customizations" JSONB,
    "status" "HouseholdItemOrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" UUID,
    "paidAt" TIMESTAMP(3),
    "productionStatus" "CustomProductionStatus" DEFAULT 'NOT_STARTED',
    "productionStartedAt" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "finalPhotosUrl" TEXT[],
    "finalPhotosApprovedAt" TIMESTAMP(3),
    "finalPhotosApprovalStatus" "CustomPhotoApprovalStatus",
    "finalPhotosRejectionReason" TEXT,
    "deliveryStatus" "StockDeliveryStatus",
    "verifiedByAgentAt" TIMESTAMP(3),
    "agentVerificationNotes" TEXT,
    "isItemNew" BOOLEAN,
    "refundEligibleUntil" TIMESTAMP(3),
    "refundRequested" BOOLEAN NOT NULL DEFAULT false,
    "refundRequestedAt" TIMESTAMP(3),
    "refundAmount" DOUBLE PRECISION,
    "refundReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundStatus" "RefundStatus",
    "agentFeeAmount" DOUBLE PRECISION,
    "agentFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "agentFeePaidAt" TIMESTAMP(3),
    "complaintRaised" BOOLEAN NOT NULL DEFAULT false,
    "complaintRaisedAt" TIMESTAMP(3),
    "complaintReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "agentCompletionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_item_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_assistant_chats" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "householdItemId" UUID NOT NULL,
    "status" "VAChatStatus" NOT NULL DEFAULT 'ACTIVE',
    "checkpoint1_ItemTypeUnderstand" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint2_PaymentWarning" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint3_H12Liability" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint4_ProcessUnderstand" BOOLEAN NOT NULL DEFAULT false,
    "checkpoint5_FinalConfirm" BOOLEAN NOT NULL DEFAULT false,
    "customizations" JSONB,
    "totalPrice" DOUBLE PRECISION,
    "readyForPayment" BOOLEAN NOT NULL DEFAULT false,
    "readyForPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_assistant_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_assistant_chat_messages" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "senderType" "VAChatSenderType" NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" "VAChatMessageType" NOT NULL DEFAULT 'TEXT',
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "actionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_assistant_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_fee_payments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "paystackReference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "h12KeepsAmount" DOUBLE PRECISION NOT NULL,
    "agentFeeAmount" DOUBLE PRECISION,
    "agentFeePaidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_item_payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "h12CommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "h12CommissionAmount" DOUBLE PRECISION NOT NULL,
    "sellerAmount" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_item_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdItem_type_idx" ON "HouseholdItem"("type");

-- CreateIndex
CREATE INDEX "HouseholdItem_status_idx" ON "HouseholdItem"("status");

-- CreateIndex
CREATE INDEX "HouseholdItem_sellerId_idx" ON "HouseholdItem"("sellerId");

-- CreateIndex
CREATE INDEX "HouseholdItem_isDeleted_idx" ON "HouseholdItem"("isDeleted");

-- CreateIndex
CREATE INDEX "HouseholdItemImage_itemId_idx" ON "HouseholdItemImage"("itemId");

-- CreateIndex
CREATE INDEX "household_item_orders_itemId_idx" ON "household_item_orders"("itemId");

-- CreateIndex
CREATE INDEX "household_item_orders_buyerId_idx" ON "household_item_orders"("buyerId");

-- CreateIndex
CREATE INDEX "household_item_orders_status_idx" ON "household_item_orders"("status");

-- CreateIndex
CREATE INDEX "household_item_orders_paymentStatus_idx" ON "household_item_orders"("paymentStatus");

-- CreateIndex
CREATE INDEX "household_item_orders_productionStatus_idx" ON "household_item_orders"("productionStatus");

-- CreateIndex
CREATE INDEX "virtual_assistant_chats_userId_idx" ON "virtual_assistant_chats"("userId");

-- CreateIndex
CREATE INDEX "virtual_assistant_chats_householdItemId_idx" ON "virtual_assistant_chats"("householdItemId");

-- CreateIndex
CREATE INDEX "virtual_assistant_chats_status_idx" ON "virtual_assistant_chats"("status");

-- CreateIndex
CREATE INDEX "virtual_assistant_chat_messages_chatId_idx" ON "virtual_assistant_chat_messages"("chatId");

-- CreateIndex
CREATE INDEX "virtual_assistant_chat_messages_createdAt_idx" ON "virtual_assistant_chat_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_fee_payments_paystackReference_key" ON "reservation_fee_payments"("paystackReference");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_userId_idx" ON "reservation_fee_payments"("userId");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_propertyId_idx" ON "reservation_fee_payments"("propertyId");

-- CreateIndex
CREATE INDEX "reservation_fee_payments_status_idx" ON "reservation_fee_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "household_item_payments_paystackReference_key" ON "household_item_payments"("paystackReference");

-- CreateIndex
CREATE INDEX "household_item_payments_orderId_idx" ON "household_item_payments"("orderId");

-- CreateIndex
CREATE INDEX "household_item_payments_userId_idx" ON "household_item_payments"("userId");

-- CreateIndex
CREATE INDEX "household_item_payments_status_idx" ON "household_item_payments"("status");

-- CreateIndex
CREATE INDEX "Item_itemType_idx" ON "Item"("itemType");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Item_currentReservationBy_idx" ON "Item"("currentReservationBy");

-- CreateIndex
CREATE INDEX "Item_isReserved_idx" ON "Item"("isReserved");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_currentReservationBy_fkey" FOREIGN KEY ("currentReservationBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdItem" ADD CONSTRAINT "HouseholdItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdItem" ADD CONSTRAINT "HouseholdItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdItemImage" ADD CONSTRAINT "HouseholdItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "HouseholdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_item_orders" ADD CONSTRAINT "household_item_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "HouseholdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_item_orders" ADD CONSTRAINT "household_item_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_item_orders" ADD CONSTRAINT "household_item_orders_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_assistant_chats" ADD CONSTRAINT "virtual_assistant_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_assistant_chats" ADD CONSTRAINT "virtual_assistant_chats_householdItemId_fkey" FOREIGN KEY ("householdItemId") REFERENCES "HouseholdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_assistant_chat_messages" ADD CONSTRAINT "virtual_assistant_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "virtual_assistant_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_fee_payments" ADD CONSTRAINT "reservation_fee_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_fee_payments" ADD CONSTRAINT "reservation_fee_payments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_item_payments" ADD CONSTRAINT "household_item_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "household_item_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
