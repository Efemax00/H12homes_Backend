-- CreateEnum
CREATE TYPE "LandlordVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FRAUD_SUSPECT');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "agentId" UUID;

-- CreateTable
CREATE TABLE "Landlord" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "verificationStatus" "LandlordVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "nationalIdUrl" TEXT,
    "utilityBillUrl" TEXT,
    "cacDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyToLandlord" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyToLandlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptProof" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAgreement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "propertyId" UUID,
    "termsVersion" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TermsAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsQuizSubmission" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsQuizSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyToLandlord_propertyId_idx" ON "PropertyToLandlord"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyToLandlord_landlordId_idx" ON "PropertyToLandlord"("landlordId");

-- CreateIndex
CREATE INDEX "ReceiptProof_propertyId_idx" ON "ReceiptProof"("propertyId");

-- CreateIndex
CREATE INDEX "ReceiptProof_buyerId_idx" ON "ReceiptProof"("buyerId");

-- CreateIndex
CREATE INDEX "ReceiptProof_landlordId_idx" ON "ReceiptProof"("landlordId");

-- CreateIndex
CREATE INDEX "ReceiptProof_status_idx" ON "ReceiptProof"("status");

-- CreateIndex
CREATE INDEX "TermsAgreement_userId_idx" ON "TermsAgreement"("userId");

-- CreateIndex
CREATE INDEX "TermsAgreement_propertyId_idx" ON "TermsAgreement"("propertyId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyToLandlord" ADD CONSTRAINT "PropertyToLandlord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyToLandlord" ADD CONSTRAINT "PropertyToLandlord_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptProof" ADD CONSTRAINT "ReceiptProof_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptProof" ADD CONSTRAINT "ReceiptProof_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptProof" ADD CONSTRAINT "ReceiptProof_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptProof" ADD CONSTRAINT "ReceiptProof_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAgreement" ADD CONSTRAINT "TermsAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAgreement" ADD CONSTRAINT "TermsAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsQuizSubmission" ADD CONSTRAINT "TermsQuizSubmission_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "TermsAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
