// create-chat.dto.ts
export class CreateChatDto {
  propertyId: string;
  userId?: string;
  // userId is added from CurrentUser decorator
}