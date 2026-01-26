// rate-agent.dto.ts
export class RateAgentDto {
  responsivenessRating?: number; // 1-5
  professionalismRating?: number; // 1-5
  helpfulnessRating?: number; // 1-5
  knowledgeRating?: number; // 1-5
  trustworthinessRating?: number; // 1-5
  overallRating: number; // 1-5 REQUIRED
  reviewText?: string;
  tipAmount?: number;
}