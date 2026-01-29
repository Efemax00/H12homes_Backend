import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkPaymentReceivedDto } from './dto/mark-payment-received.dto';
import { RateAgentDto } from './dto/rate-agent.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ChatStatus, ItemStatus, ReservationFeeStatus } from '@prisma/client';
import { ItemsService } from '../items/items.service';
import { ChatService } from '../chat/chat.service';

const AI_USER_ID = "00000000-0000-0000-0000-000000000001";

@Injectable()
export class ChatsService {
  constructor(
    private prisma: PrismaService,
    private itemsService: ItemsService,
    private chatService: ChatService,
  ) {}

  /**
   * Create chat when user pays ₦10,000 reservation fee
   * Auto-assigns agent and creates chat record
   */
  async createChat(createChatDto: CreateChatDto, userId: string) {
    const { propertyId } = createChatDto;

    // Verify property exists
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      include: { agent: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check if user already has active chat for this property
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        userId,
        propertyId,
        status: {
          in: ['OPEN', 'ACTIVE', 'PAYMENT_RECEIVED'] as ChatStatus[],
        },
      },
    });

    if (existingChat) {
      throw new BadRequestException(
        'You already have an active chat for this property',
      );
    }

    // Determine chat type: VA or direct agent
    const chatType = createChatDto.chatType || 'VA'; // Default to VA

    let agentId: string | null = null;

    // If direct agent chat, use property's agent
    if (chatType === 'AGENT') {
      if (!property.agentId) {
        throw new BadRequestException('This property has no agent assigned');
      }
      agentId = property.agentId;
    }
    // If VA chat (default), agentId stays null

    // Calculate agent fee (10% of property price)
    const agentFeePercentage = 10;
    const agentFeeTotal = (property.price * agentFeePercentage) / 100;
    const agentFeeAmount = (agentFeeTotal * 70) / 100; // Agent gets 70%

    // Create chat - FIX: Use proper conditional for optional agentId
    const chatData: any = {
      userId,
      propertyId,
      status: 'OPEN' as ChatStatus,
      agentFeePercentage,
      agentFeeAmount,
      agentPaymentStatus: 'PENDING',
    };

    // Only add agentId if it's not null
    if (agentId) {
      chatData.agentId = agentId;
    }

    const chat = await this.prisma.chat.create({
      data: chatData,
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            category: true,
          },
        },
      },
    });

    // Log activity (only for agent chats)
    if (agentId) {
      await this.prisma.agentActivityLog.create({
        data: {
          chatId: chat.id,
          agentId,
          actionType: 'CHAT_ASSIGNED',
          metadata: {
            propertyPrice: property.price,
            agentFeeAmount,
          },
        },
      });
    }

    // Send system message based on chat type
    if (chatType === 'VA') {
      // VA chat - message from system
      await this.prisma.chatMessageModel.create({
        data: {
          chatId: chat.id,
          senderId: AI_USER_ID, // system message
          message: `Hi! 👋 I'm your Virtual Assistant. I'm here to help you with this property. How can I assist you today?`,
          messageType: 'SYSTEM',
        },
      });
    } else {
      // Agent chat - message from agent
      await this.prisma.chatMessageModel.create({
        data: {
          chatId: chat.id,
          senderId: agentId!, // agentId is guaranteed to exist in AGENT chat type
          message: `Welcome! I'm your H12homes agent. I'm here to help you complete this transaction. Property: ${property.title}`,
          messageType: 'SYSTEM',
        },
      });
    }

    return {
      chat,
      message: 'Chat created successfully. Agent will respond shortly.',
    };
  }

  async startChatAndMarkPending(propertyId: string, userId: string) {
    // 1) Get existing active chat first
    let chat = await this.prisma.chat.findFirst({
      where: {
        userId,
        propertyId,
        status: { in: ['OPEN', 'ACTIVE', 'PAYMENT_RECEIVED'] as ChatStatus[] },
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            category: true,
          },
        },
      },
    });

    // 2) If none, create VA chat
    if (!chat) {
      const created = await this.createChat(
        { propertyId, chatType: 'VA' } as any,
        userId,
      );
      chat = created.chat; // ✅ now chat is assigned properly
    }

    // 3) Soft-hold property for 15 mins
    const updatedProperty = await this.itemsService.softHoldForChat(
      propertyId,
      userId,
    );

    return { chat, property: updatedProperty };
  }

  async renewPending(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true, propertyId: true, agentId: true },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Not allowed');

    // If it's agent chat, you can still renew the hold (up to you)
    const updatedProperty = await this.itemsService.renewSoftHoldForChat(
      chat.propertyId,
      userId,
    );

    return { property: updatedProperty };
  }

  async releasePending(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { userId: true, propertyId: true },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Not allowed');

    return this.itemsService.releaseSoftHoldForChat(chat.propertyId, userId);
  }

  /**
   * Get chat details with agent info and messages
   */
  async getChatDetails(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            category: true,
          },
        },
        userRating: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check authorization
    if (chat.userId !== userId && chat.agentId !== userId) {
      throw new ForbiddenException('Not authorized to view this chat');
    }

    // Mark messages as read
    await this.prisma.chatMessageModel.updateMany({
      where: { chatId, senderId: { not: userId } },
      data: { readAt: new Date() },
    });

    return chat;
  }

  /**
   * Get user's active chats
   */
  async getUserChats(userId: string, status?: ChatStatus) {
    const whereClause = {
      userId,
      propertyId: {
        not: undefined,
      },
      ...(status
        ? { status }
        : {
            status: {
              in: ['OPEN', 'ACTIVE', 'PAYMENT_RECEIVED'] as ChatStatus[],
            },
          }),
    };

    return this.prisma.chat.findMany({
      where: whereClause,
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChatByProperty(propertyId: string, userId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        propertyId,
        userId,
        status: {
          in: ['OPEN', 'ACTIVE', 'PAYMENT_RECEIVED'] as ChatStatus[],
        },
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found for this property');
    }

    return chat;
  }

  /**
   * Get agent's assigned chats
   */
  async getAgentChats(agentId: string, status?: ChatStatus) {
    const whereClause = {
      agentId,
      ...(status
        ? { status }
        : {
            status: {
              in: ['OPEN', 'ACTIVE', 'PAYMENT_RECEIVED'] as ChatStatus[],
            },
          }),
    };

    return this.prisma.chat.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { lastUserMessageAt: 'desc' },
    });
  }

  /**
   * Send message in chat
   */
  async sendMessage(
    chatId: string,
    userId: string,
    sendMessageDto: SendMessageDto,
  ) {
    const { message } = sendMessageDto;

    // Verify chat exists
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check authorization (user or agent only)
    if (chat.userId !== userId && chat.agentId !== userId) {
      throw new ForbiddenException(
        'Not authorized to send messages in this chat',
      );
    }

    // Can't send messages if chat is closed
    if (chat.status === 'CLOSED') {
      throw new BadRequestException(
        'This chat is closed. Cannot send messages.',
      );
    }

    // Create message
    const newMessage = await this.prisma.chatMessageModel.create({
      data: {
        chatId,
        senderId: userId,
        message,
        messageType: 'TEXT',
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // ✅ Auto-reply only for VA chats (agentId is null)
    const isVAChat = !chat.agentId;

    if (isVAChat) {
      this.generateVaReply(chatId, message).catch((e) => {
        console.error('Groq VA reply failed:', e?.message || e);
      });
    }

    // Update chat stats
    const isAgent = chat.agentId === userId;
    if (isAgent) {
      // Agent responded
      const updateData: any = {
        lastAgentResponseAt: new Date(),
        agentResponseCount: { increment: 1 },
        status: 'ACTIVE' as ChatStatus,
      };

      // Track first response
      if (!chat.firstAgentResponseAt) {
        updateData.firstAgentResponseAt = new Date();

        // Calculate response time in minutes
        const responseTime = Math.round(
          (new Date().getTime() - chat.createdAt.getTime()) / (1000 * 60),
        );
        updateData.averageResponseTimeMinutes = responseTime;

        // Check if within 24 hours
        if (responseTime <= 1440) {
          updateData.wasAgentResponsive = true;
        } else {
          updateData.agentMissedFirstResponse = true;
        }
      }

      await this.prisma.chat.update({
        where: { id: chatId },
        data: updateData,
      });

      // Log agent activity
      await this.prisma.agentActivityLog.create({
        data: {
          chatId,
          agentId: userId,
          actionType: 'MESSAGE_SENT',
          metadata: { messageId: newMessage.id },
        },
      });
    } else {
      // User sent message
      await this.prisma.chat.update({
        where: { id: chatId },
        data: {
          userMessageCount: { increment: 1 },
          lastUserMessageAt: new Date(),
        },
      });
    }

    return newMessage;
  }

  private async generateVaReply(chatId: string, userText: string) {
    try {
      console.log('🤖 generateVaReply START', { chatId });

      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          property: {
            select: {
              title: true,
              price: true,
              location: true,
              category: true,
            },
          },
        },
      });

      const context = chat?.property
        ? `Property context:
Title: ${chat.property.title}
Price: ₦${chat.property.price}
Location: ${chat.property.location}
Category: ${chat.property.category}

Keep reply short, helpful, and Nigerian context.`
        : undefined;

      console.log('🤖 calling Groq...', { hasContext: !!context });

      const groq = await this.chatService.sendMessage([
        ...(context ? [{ role: 'system', content: context }] : []),
        { role: 'user', content: userText },
      ]);

      console.log('✅ Groq returned:', groq?.message?.slice(0, 80));

      const aiText = groq?.message || "I'm here—how can I help?";

      const saved = await this.prisma.chatMessageModel.create({
        data: {
          chatId,
          senderId: AI_USER_ID,
          message: aiText,
          messageType: 'SYSTEM',
        },
      });

      console.log('✅ AI message SAVED', {
        id: saved.id,
        senderId: saved.senderId,
      });
    } catch (e: any) {
      console.error('❌ generateVaReply FAILED:', e?.message || e);
    }
  }

  /**
   * Get chat messages with pagination
   */
  async getChatMessages(
    chatId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.prisma.chatMessageModel.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Admin marks payment received - AUTO CLOSES CHAT
   */
  async markPaymentReceived(
    chatId: string,
    adminId: string,
    markPaymentDto: MarkPaymentReceivedDto,
  ) {
    const { paymentConfirmationDetails } = markPaymentDto;

    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Update chat - mark payment and close immediately
    const updatedChat = await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        status: 'PAYMENT_RECEIVED' as ChatStatus,
        paymentReceivedAt: new Date(),
        closedAt: new Date(),
        closedByAdminId: adminId,
        closureReason: 'PAYMENT_RECEIVED',
        agentPaymentStatus: 'PAYMENT_RECEIVED',
      },
      include: {
        agent: true,
        user: true,
        property: true,
      },
    });

    // Log activity
    if (chat.agentId) {
      await this.prisma.agentActivityLog.create({
        data: {
          chatId,
          agentId: chat.agentId,
          actionType: 'PAYMENT_CONFIRMED',
          metadata: {
            confirmedBy: adminId,
            details: paymentConfirmationDetails,
          },
        },
      });
    }

    // Send system message to both
    const agentFeeMessage = updatedChat.agentFeeAmount
      ? ` ${updatedChat.agent?.firstName}, agent fee of ₦${updatedChat.agentFeeAmount?.toLocaleString()} will be processed.`
      : '';

    await this.prisma.chatMessageModel.create({
      data: {
        chatId,
        senderId: adminId,
        message: `✅ Payment confirmed! This chat is now closed. Thank you for using H12homes.${agentFeeMessage}`,
        messageType: 'ADMIN_NOTIFICATION',
      },
    });

    // Update agent statistics (only if agent exists)
    if (chat.agentId) {
      await this.updateAgentStats(chat.agentId, {
        totalChatsCompleted: 1,
        totalEarnings: updatedChat.agentFeeAmount || 0,
      });
    }

    return {
      ...updatedChat,
      message: 'Chat closed. Agent will be paid shortly.',
    };
  }

  /**
   * Rate agent after chat closes
   */
  async rateAgent(chatId: string, userId: string, rateAgentDto: RateAgentDto) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.userId !== userId) {
      throw new ForbiddenException('Only the user can rate the agent');
    }

    if (chat.status !== 'CLOSED') {
      throw new BadRequestException('Can only rate after chat is closed');
    }

    // Check if already rated
    const existingRating = await this.prisma.userRating.findUnique({
      where: { chatId },
    });

    if (existingRating) {
      throw new BadRequestException(
        'You have already rated this agent for this chat',
      );
    }

    if (!chat.agentId) {
      throw new BadRequestException(
        'This chat has no agent assigned. You cannot rate an agent.',
      );
    }

    // Create rating
    const rating = await this.prisma.userRating.create({
      data: {
        chatId,
        userId,
        agentId: chat.agentId,
        responsivenessRating: rateAgentDto.responsivenessRating,
        professionalismRating: rateAgentDto.professionalismRating,
        helpfulnessRating: rateAgentDto.helpfulnessRating,
        knowledgeRating: rateAgentDto.knowledgeRating,
        trustworthinessRating: rateAgentDto.trustworthinessRating,
        overallRating: rateAgentDto.overallRating,
        reviewText: rateAgentDto.reviewText,
        tipAmount: rateAgentDto.tipAmount,
      },
    });

    // Update agent statistics (only if agent exists)
    if (chat.agentId) {
      await this.updateAgentStats(chat.agentId, {
        totalRatingsReceived: 1,
        totalTipsEarned: rateAgentDto.tipAmount || 0,
      });
    }

    return {
      rating,
      message: 'Thank you for rating! Your feedback helps us improve.',
    };
  }

  /**
   * User reports conversation
   */
  async reportConversation(
    chatId: string,
    userId: string,
    reportDto: ReportConversationDto,
  ) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.userId !== userId) {
      throw new ForbiddenException(
        'Only the user can report this conversation',
      );
    }

    if (!chat.agentId) {
      throw new BadRequestException(
        'This chat has no agent assigned. You cannot report an agent.',
      );
    }

    // Create report
    const report = await this.prisma.conversationReport.create({
      data: {
        chatId,
        userId,
        reportedAgentId: chat.agentId,
        reason: reportDto.reason,
        description: reportDto.description,
      },
    });

    return {
      report,
      message: 'Report submitted. Our team will review and take action.',
    };
  }

  /**
   * Request user to rate agent
   */
  async requestRating(chatId: string, adminId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        userRating: true,
        agent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.userRating) {
      throw new BadRequestException('User already submitted rating');
    }

    // Update rating request flag
    const ratingData: any = {
      userId: chat.userId,
      overallRating: 0, // Placeholder
      adminRequestedRating: true,
      adminRequestedAt: new Date(),
    };

    if (chat.agentId) {
      ratingData.agentId = chat.agentId;
    }

    await this.prisma.userRating.upsert({
      where: { chatId },
      create: {
        chatId,
        ...ratingData,
      },
      update: ratingData,
    });

    // Send message to user
    await this.prisma.chatMessageModel.create({
      data: {
        chatId,
        senderId: adminId,
        message: `Please rate your experience with our agent ${chat.agent?.firstName || 'our team'}. Your feedback helps us improve our service.`,
        messageType: 'ADMIN_NOTIFICATION',
      },
    });

    return { message: 'Rating request sent to user' };
  }

  /**
   * Helper: Update agent statistics
   */
  private async updateAgentStats(
    agentId: string,
    updates: {
      totalChatsCompleted?: number;
      totalEarnings?: number;
      totalRatingsReceived?: number;
      totalTipsEarned?: number;
    },
  ) {
    let stats = await this.prisma.agentStatistics.findUnique({
      where: { agentId },
    });

    if (!stats) {
      stats = await this.prisma.agentStatistics.create({
        data: { agentId },
      });
    }

    await this.prisma.agentStatistics.update({
      where: { agentId },
      data: {
        totalChatsCompleted:
          (stats.totalChatsCompleted || 0) + (updates.totalChatsCompleted || 0),
        totalEarnings:
          (stats.totalEarnings || 0) + (updates.totalEarnings || 0),
        totalRatingsReceived:
          (stats.totalRatingsReceived || 0) +
          (updates.totalRatingsReceived || 0),
        totalTipsEarned:
          (stats.totalTipsEarned || 0) + (updates.totalTipsEarned || 0),
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Admin: Get all chats with filters
   */
  async getAllChats(
    status?: ChatStatus,
    agentId?: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (agentId) whereClause.agentId = agentId;

    return this.prisma.chat.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        agent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Admin: Get chats pending payment closure
   */
  async getPendingPaymentChats() {
    return this.prisma.chat.findMany({
      where: {
        status: 'ACTIVE' as ChatStatus,
        paymentReceivedAt: null,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        agent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { lastUserMessageAt: 'desc' },
    });
  }

  /**
   * Admin: Get chats waiting for rating request
   */
  async getChatsAwaitingRating() {
    return this.prisma.chat.findMany({
      where: {
        status: 'CLOSED' as ChatStatus,
        userRating: {
          adminRequestedRating: false,
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        agent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            title: true,
          },
        },
      },
    });
  }
}
