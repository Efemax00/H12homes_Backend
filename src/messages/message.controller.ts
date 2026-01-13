import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { MessagesService } from './message.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, MessageType } from '@prisma/client';

@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  // ==================== INTEREST ENDPOINTS ====================

  /**
   * User expresses interest in a property
   * POST /messages/interest/:propertyId
   */
  @UseGuards(JwtAuthGuard)
  @Post('interest/:propertyId')
  async expressInterest(@Req() req, @Param('propertyId') propertyId: string) {
    return this.messagesService.expressInterest(req.user.id, propertyId);
  }

   /**
   * Get logged-in user's conversations (buyer/user side)
   * GET /messages/my-user-conversations
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-user-conversations')
  async getMyUserConversations(@Req() req) {
    return this.messagesService.getUserConversations(req.user.id);
  }

  /**
   * Get all interested users for a property (Admin only)
   * GET /messages/property/:propertyId/interests
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('property/:propertyId/interests')
  async getPropertyInterests(@Req() req, @Param('propertyId') propertyId: string) {
    return this.messagesService.getPropertyInterests(propertyId, req.user.id);
  }

  /**
   * Get user's own interests (properties they inquired about)
   * GET /messages/my-interests
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-interests')
  async getMyInterests(@Req() req) {
    return this.messagesService.getUserInterests(req.user.id);
  }

  // ==================== CHAT ENDPOINTS ====================

  /**
   * Send a message
   * POST /messages/send
   */
  @UseGuards(JwtAuthGuard)
@Post('send')
async sendMessage(
  @Req() req,
  @Body() body: any,  // ✅ Change to 'any' temporarily to see raw data
) {
  console.log('🔍 RAW BODY:', body);
  console.log('🔍 propertyId:', body.propertyId);
  console.log('🔍 message:', body.message);
  
  return this.messagesService.sendMessage(
    req.user.id,
    body.propertyId,
    body.message,
    body.messageType,
    body.attachmentUrl,
  );
}

  /**
   * Get chat history for a property
   * GET /messages/chat/:propertyId
   */
  @UseGuards(JwtAuthGuard)
  @Get('chat/:propertyId')
  async getChatHistory(@Req() req, @Param('propertyId') propertyId: string) {
    return this.messagesService.getChatHistory(propertyId, req.user.id);
  }

  /**
   * Get admin's conversations (their properties only)
   * GET /messages/my-conversations
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('my-conversations')
  async getMyConversations(@Req() req) {
    if (req.user.role === Role.SUPER_ADMIN) {
      // Super admin can see all
      return this.messagesService.getAllConversations();
    }
    // Regular admin sees only their properties
    return this.messagesService.getAdminConversations(req.user.id);
  }

  /**
   * Get all conversations (SUPER_ADMIN only)
   * GET /messages/all-conversations
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('all-conversations')
  async getAllConversations() {
    return this.messagesService.getAllConversations();
  }

  // ==================== SALES ENDPOINTS ====================

  /**
   * Mark property as sold
   * POST /messages/mark-sold
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('mark-sold')
  async markAsSold(
    @Req() req,
    @Body()
    body: {
      propertyId: string;
      buyerId: string;
      amount: number;
      paymentProofUrl?: string;
    },
  ) {
    return this.messagesService.markAsSold(
      req.user.id,
      body.propertyId,
      body.buyerId,
      body.amount,
      body.paymentProofUrl,
    );
  }

  /**
   * Get admin's sales history
   * GET /messages/my-sales
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('my-sales')
  async getMySales(@Req() req) {
    if (req.user.role === Role.SUPER_ADMIN) {
      // Super admin can see all sales
      return this.messagesService.getAllSales();
    }
    // Regular admin sees only their sales
    return this.messagesService.getAdminSales(req.user.id);
  }

  /**
   * Get all sales (SUPER_ADMIN only)
   * GET /messages/all-sales
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('all-sales')
  async getAllSales() {
    return this.messagesService.getAllSales();
  }

  // ==================== AUDIT ENDPOINTS ====================

  /**
   * Get audit logs (SUPER_ADMIN only)
   * GET /messages/audit-logs
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('audit-logs')
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.messagesService.getAuditLogs({
      userId,
      action,
      entityType,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    });
  }
}