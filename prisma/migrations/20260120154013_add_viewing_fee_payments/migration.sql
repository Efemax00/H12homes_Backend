-- CreateTable
CREATE TABLE "viewing_fee_payments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "agentShare" DOUBLE PRECISION NOT NULL,
    "companyShare" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viewing_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "viewing_fee_payments_paystackReference_key" ON "viewing_fee_payments"("paystackReference");

-- CreateIndex
CREATE INDEX "viewing_fee_payments_userId_idx" ON "viewing_fee_payments"("userId");

-- CreateIndex
CREATE INDEX "viewing_fee_payments_propertyId_idx" ON "viewing_fee_payments"("propertyId");

-- CreateIndex
CREATE INDEX "viewing_fee_payments_status_idx" ON "viewing_fee_payments"("status");

-- CreateIndex
CREATE INDEX "viewing_fee_payments_paystackReference_idx" ON "viewing_fee_payments"("paystackReference");

-- AddForeignKey
ALTER TABLE "viewing_fee_payments" ADD CONSTRAINT "viewing_fee_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewing_fee_payments" ADD CONSTRAINT "viewing_fee_payments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
