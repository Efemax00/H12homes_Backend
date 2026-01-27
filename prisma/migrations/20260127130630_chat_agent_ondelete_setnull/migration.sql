-- DropForeignKey
ALTER TABLE "chats" DROP CONSTRAINT "chats_agentId_fkey";

-- AlterTable
ALTER TABLE "chats" ALTER COLUMN "agentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
