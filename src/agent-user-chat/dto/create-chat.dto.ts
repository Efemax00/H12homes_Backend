import { IsEnum, IsOptional } from "class-validator";

// create-chat.dto.ts
export class CreateChatDto {
  propertyId: string;
  userId?: string;
  @IsOptional()
  @IsEnum(['VA', 'AGENT'])
  chatType?: string; // 'VA' or 'AGENT'
  
}