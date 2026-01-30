import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpException,
  BadRequestException,
  HttpStatus,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ChatsService } from './agent-user-chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkPaymentReceivedDto } from './dto/mark-payment-received.dto';
import { RateAgentDto } from './dto/rate-agent.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ChatStatus } from '@prisma/client';
import { ReservationFeePaymentService } from '../payment/reservation-fee-payment.service';




@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly reservationFeePaymentService: ReservationFeePaymentService
  ) {}

  /**
   * POST /chats/create
   * Create chat when user pays ₦10,000 reservation fee
   */
  @Post('create')
async createChat(
  @Body() createChatDto: CreateChatDto,
  @CurrentUser() user: { id: string },
) {
  try {
    const { propertyId } = createChatDto;

    // 🔥 VERIFY PAYMENT FIRST - Before creating chat
    const hasReservation = await this.reservationFeePaymentService.hasUserActiveReservation(
      user.id,
      propertyId,
    );

    if (!hasReservation) {
      throw new BadRequestException(
        'You must pay ₦10,000 reservation fee first to start a chat',
      );
    }

    // ✅ THEN create chat (payment already verified)
    return await this.chatsService.createChat(createChatDto, user.id);
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}

  /**
   * POST /chats/start
   * Start or get chat for a property AND mark property as PENDING (soft lock).
   * Body: { propertyId }
   */
  @Post('start')
async startChatAndMarkPending(
  @Body() body: { propertyId: string },
  @CurrentUser() user: { id: string },
) {
  try {
    const { propertyId } = body;

    if (!propertyId) {
      throw new BadRequestException('propertyId is required');
    }

    // 🔥 VERIFY PAYMENT FIRST
    const hasReservation = await this.reservationFeePaymentService.hasUserActiveReservation(
      user.id,
      propertyId,
    );

    if (!hasReservation) {
      throw new BadRequestException(
        'You must pay ₦10,000 reservation fee first',
      );
    }

    // ✅ THEN create chat
    return await this.chatsService.startChatAndMarkPending(
      propertyId,
      user.id,
    );
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}

  /**
   * PATCH /chats/:id/pending/renew
   * Renew pending hold (TTL) while user is active in chat.
   */
  @Patch(':id/pending/renew')
  async renewPending(
    @Param('id') chatId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.renewPending(chatId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /chats/:id/pending/release
   * Optional: release pending when user leaves chat (TTL-only is still fine).
   */
  @Patch(':id/pending/release')
  async releasePending(
    @Param('id') chatId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.releasePending(chatId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/user/active
   * Get user's active chats
   */
  @Get('user/active')
  async getUserChats(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
  ) {
    try {
      const chatStatus = status ? (status as ChatStatus) : undefined;
      return await this.chatsService.getUserChats(user.id, chatStatus);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/agent/assigned
   * Get agent's assigned chats
   */
  @Get('agent/assigned')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getAgentChats(@CurrentUser() user: { id: string }) {
    return this.chatsService.getAgentChats(user.id);
  }

  /**
   * GET /chats/admin/all
   * Admin: Get all chats
   */
  @Get('admin/all')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getAllChats(
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    try {
      const chatStatus = status ? (status as ChatStatus) : undefined;
      return await this.chatsService.getAllChats(
        chatStatus,
        agentId,
        limit,
        offset,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/admin/pending-payment
   * Admin: Get chats waiting for payment confirmation
   */
  @Get('admin/pending-payment')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getPendingPaymentChats() {
    try {
      return await this.chatsService.getPendingPaymentChats();
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/admin/pending-rating
   * Admin: Get chats waiting for rating request
   */
  @Get('admin/pending-rating')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getChatsAwaitingRating() {
    try {
      return await this.chatsService.getChatsAwaitingRating();
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/property/:propertyId
   * Get user's existing chat for a property
   */
  @Get('property/:propertyId')
  async getChatByProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.getChatByProperty(propertyId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * GET /chats/:id
   * Get chat details with messages and agent info
   */
  @Get(':id')
  async getChatDetails(
    @Param('id') chatId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.getChatDetails(chatId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /chats/:id/messages
   * Send message in chat
   */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') chatId: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.sendMessage(
        chatId,
        user.id,
        sendMessageDto,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /chats/:id/messages
   * Get chat messages
   */
  @Get(':id/messages')
  async getChatMessages(
    @Param('id', new ParseUUIDPipe()) chatId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @CurrentUser() user: { id: string },
  ) {
    const chat = await this.chatsService.getChatDetails(chatId, user.id);
    if (!chat) throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);

    return this.chatsService.getChatMessages(chatId, limit, offset);
  }

  /**
   * PATCH /chats/:id/mark-payment-received
   * Admin marks payment received - AUTO CLOSES CHAT
   */
  @Patch(':id/mark-payment-received')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async markPaymentReceived(
    @Param('id') chatId: string,
    @Body() markPaymentDto: MarkPaymentReceivedDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.markPaymentReceived(
        chatId,
        user.id,
        markPaymentDto,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /chats/:id/rate-agent
   * User rates agent after chat closes
   */
  @Post(':id/rate-agent')
  async rateAgent(
    @Param('id') chatId: string,
    @Body() rateAgentDto: RateAgentDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.rateAgent(chatId, user.id, rateAgentDto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /chats/:id/report
   * User reports conversation
   */
  @Post(':id/report')
  async reportConversation(
    @Param('id') chatId: string,
    @Body() reportDto: ReportConversationDto,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.reportConversation(
        chatId,
        user.id,
        reportDto,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /chats/:id/request-rating
   * Admin requests user to rate agent
   */
  @Patch(':id/request-rating')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async requestRating(
    @Param('id') chatId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.chatsService.requestRating(chatId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
