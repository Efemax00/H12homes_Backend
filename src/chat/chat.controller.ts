import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: { messages: Array<{ role: string; content: string }> }) {
    try {
      if (!body.messages || !Array.isArray(body.messages)) {
        throw new HttpException('Invalid messages format', HttpStatus.BAD_REQUEST);
      }

      const response = await this.chatService.sendMessage(body.messages);
      return response;
    } catch (error) {
      console.error('Chat error:', error);
      throw new HttpException(
        'Failed to process chat request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}