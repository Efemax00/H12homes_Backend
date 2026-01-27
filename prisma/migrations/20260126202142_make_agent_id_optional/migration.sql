-- DropForeignKey
ALTER TABLE "agent_fee_payments" DROP CONSTRAINT "agent_fee_payments_agentId_fkey";

-- AddForeignKey
ALTER TABLE "agent_fee_payments" ADD CONSTRAINT "agent_fee_payments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
