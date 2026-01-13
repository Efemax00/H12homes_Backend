-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('CLICKED_INTERESTED', 'OPENED_WHATSAPP', 'CLICKED_PHONE', 'VIEWED_IMAGE', 'SHARED_PROPERTY', 'BOOKMARKED', 'CLICKED_DIRECTIONS', 'DOWNLOADED_BROCHURE');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "interestedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "uniqueViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappClickCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "property_views" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "userId" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "sessionId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_engagements" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "userId" UUID,
    "actionType" "EngagementType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_views_propertyId_idx" ON "property_views"("propertyId");

-- CreateIndex
CREATE INDEX "property_views_userId_idx" ON "property_views"("userId");

-- CreateIndex
CREATE INDEX "property_views_ipAddress_idx" ON "property_views"("ipAddress");

-- CreateIndex
CREATE INDEX "property_views_viewedAt_idx" ON "property_views"("viewedAt");

-- CreateIndex
CREATE INDEX "property_engagements_propertyId_idx" ON "property_engagements"("propertyId");

-- CreateIndex
CREATE INDEX "property_engagements_userId_idx" ON "property_engagements"("userId");

-- CreateIndex
CREATE INDEX "property_engagements_actionType_idx" ON "property_engagements"("actionType");

-- CreateIndex
CREATE INDEX "property_engagements_createdAt_idx" ON "property_engagements"("createdAt");

-- AddForeignKey
ALTER TABLE "property_views" ADD CONSTRAINT "property_views_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_views" ADD CONSTRAINT "property_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
