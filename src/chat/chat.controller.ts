import { Controller, Post, Body, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat
   * General chat - answers any questions
   */
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

  /**
   * POST /chat/guide/step1
   * Explain Verification Step (after payment)
   * Body: { "userName": "John", "propertyTitle": "House", "category": "SALE" or "RENT" }
   */
  @Post('guide/step1')
  @UseGuards(JwtAuthGuard)
  async getStep1Verification(
    @Body() body: { userName: string; propertyTitle: string; category: string },
  ) {
    try {
      if (!body.userName || !body.propertyTitle || !body.category) {
        throw new HttpException('Missing required fields: userName, propertyTitle, category', HttpStatus.BAD_REQUEST);
      }

      // Validate category
      if (!['RENT', 'SALE'].includes(body.category)) {
        throw new HttpException('Invalid category. Use RENT or SALE', HttpStatus.BAD_REQUEST);
      }

      const message = await this.chatService.explainVerificationStep(
        body.userName,
        body.propertyTitle,
        body.category,
      );

      return {
        step: 1,
        title: 'Identity Verification',
        duration: '24-48 hours',
        message,
      };
    } catch (error) {
      console.error('Step 1 error:', error);
      throw new HttpException(
        error.message || 'Failed to generate step guide',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /chat/guide/step2
   * Explain Inspection Step (after payment)
   * Body: { "userName": "John", "propertyTitle": "House", "category": "SALE" or "RENT" }
   */
  @Post('guide/step2')
  @UseGuards(JwtAuthGuard)
  async getStep2Inspection(
    @Body() body: { userName: string; propertyTitle: string; category: string },
  ) {
    try {
      if (!body.userName || !body.propertyTitle || !body.category) {
        throw new HttpException('Missing required fields: userName, propertyTitle, category', HttpStatus.BAD_REQUEST);
      }

      if (!['RENT', 'SALE'].includes(body.category)) {
        throw new HttpException('Invalid category. Use RENT or SALE', HttpStatus.BAD_REQUEST);
      }

      const message = await this.chatService.explainInspectionStep(
        body.userName,
        body.propertyTitle,
        body.category,
      );

      return {
        step: 2,
        title: 'Property Inspection',
        duration: '1-3 days',
        message,
      };
    } catch (error) {
      console.error('Step 2 error:', error);
      throw new HttpException(
        error.message || 'Failed to generate step guide',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /chat/guide/step3
   * Explain Documentation Step (after payment)
   * Body: { "userName": "John", "category": "SALE" or "RENT" }
   */
  @Post('guide/step3')
  @UseGuards(JwtAuthGuard)
  async getStep3Documentation(
    @Body() body: { userName: string; category: string },
  ) {
    try {
      if (!body.userName || !body.category) {
        throw new HttpException('Missing required fields: userName, category', HttpStatus.BAD_REQUEST);
      }

      if (!['RENT', 'SALE'].includes(body.category)) {
        throw new HttpException('Invalid category. Use RENT or SALE', HttpStatus.BAD_REQUEST);
      }

      const message = await this.chatService.explainDocumentationStep(
        body.userName,
        body.category,
      );

      return {
        step: 3,
        title: 'Documentation & Legal Review',
        duration: '2-5 days',
        message,
      };
    } catch (error) {
      console.error('Step 3 error:', error);
      throw new HttpException(
        error.message || 'Failed to generate step guide',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /chat/guide/step4
   * Explain Final Approval Step (after payment)
   * Body: { "userName": "John", "category": "SALE" or "RENT" }
   */
  @Post('guide/step4')
  @UseGuards(JwtAuthGuard)
  async getStep4FinalApproval(
    @Body() body: { userName: string; category: string },
  ) {
    try {
      if (!body.userName || !body.category) {
        throw new HttpException('Missing required fields: userName, category', HttpStatus.BAD_REQUEST);
      }

      if (!['RENT', 'SALE'].includes(body.category)) {
        throw new HttpException('Invalid category. Use RENT or SALE', HttpStatus.BAD_REQUEST);
      }

      const message = await this.chatService.explainFinalApprovalStep(
        body.userName,
        body.category,
      );

      return {
        step: 4,
        title: 'Final Approval',
        duration: '1-2 days',
        message,
      };
    } catch (error) {
      console.error('Step 4 error:', error);
      throw new HttpException(
        error.message || 'Failed to generate step guide',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /chat/guide/all
   * Get all 4 steps at once
   * Body: { "userName": "John", "propertyTitle": "House", "category": "SALE" or "RENT" }
   */
  @Post('guide/all')
  @UseGuards(JwtAuthGuard)
  async getAllSteps(
    @Body() body: { userName: string; propertyTitle: string; category: string },
  ) {
    try {
      if (!body.userName || !body.propertyTitle || !body.category) {
        throw new HttpException('Missing required fields: userName, propertyTitle, category', HttpStatus.BAD_REQUEST);
      }

      if (!['RENT', 'SALE'].includes(body.category)) {
        throw new HttpException('Invalid category. Use RENT or SALE', HttpStatus.BAD_REQUEST);
      }

      const steps = await Promise.all([
        this.chatService.explainVerificationStep(body.userName, body.propertyTitle, body.category),
        this.chatService.explainInspectionStep(body.userName, body.propertyTitle, body.category),
        this.chatService.explainDocumentationStep(body.userName, body.category),
        this.chatService.explainFinalApprovalStep(body.userName, body.category),
      ]);

      return {
        success: true,
        propertyType: body.category,
        guides: [
          {
            step: 1,
            title: 'Identity Verification',
            duration: '24-48 hours',
            message: steps[0],
          },
          {
            step: 2,
            title: 'Property Inspection',
            duration: '1-3 days',
            message: steps[1],
          },
          {
            step: 3,
            title: 'Documentation & Legal Review',
            duration: '2-5 days',
            message: steps[2],
          },
          {
            step: 4,
            title: 'Final Approval',
            duration: '1-2 days',
            message: steps[3],
          },
        ],
      };
    } catch (error) {
      console.error('All steps error:', error);
      throw new HttpException(
        error.message || 'Failed to generate step guides',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}