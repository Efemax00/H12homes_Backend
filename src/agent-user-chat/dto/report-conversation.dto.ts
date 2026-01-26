// report-conversation.dto.ts
export enum ReportReason {
  UNPROFESSIONAL_CONDUCT = 'UNPROFESSIONAL_CONDUCT',
  UNRESPONSIVE = 'UNRESPONSIVE',
  MISLEADING_INFORMATION = 'MISLEADING_INFORMATION',
  FRAUD_ATTEMPT = 'FRAUD_ATTEMPT',
  OTHER = 'OTHER',
}

export class ReportConversationDto {
  reason: ReportReason;
  description: string;
}