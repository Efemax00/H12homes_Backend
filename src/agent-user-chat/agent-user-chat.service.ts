import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkPaymentReceivedDto } from './dto/mark-payment-received.dto';
import { RateAgentDto } from './dto/rate-agent.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import {
  ChatStatus,
  ItemStatus,
  Role,
  ReservationFeeStatus,
  AgentPaymentStatus,
} from '@prisma/client';
import { ItemsService } from '../items/items.service';
import { ChatService } from '../chat/chat.service';
import { toWhatsAppLink } from '../utils/whatsapp.util';

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const AI_USER_ID = '00000000-0000-0000-0000-000000000001';

// AI Agent Configuration
const AI_UNLOCK_KEYWORDS = [
  "i'm ready to meet my agent",
  'connect me to agent',
  'talk to the agent',
  'ready for agent',
  'agent please',
  "i'm ready for agent",
  'connect to agent',
  'ready to meet agent',
  'transfer to agent',
];

const AI_GREETING_RESPONSES = {
  greeting: `Hi! 👋 Welcome to H12 Homes!

I see you've reserved this property. Before I connect you with your dedicated agent, let me help you think through what you're looking for. This will help our agent tailor the best experience for you.

What's most important to you in this property? 
- Location & accessibility
- Modern amenities  
- Price & affordability
- Size & space
- Safety & security`,

  unlock_prompt: `Perfect! I've got a good understanding of what you're looking for.

🔑 Your dedicated agent is ready to take over from here. They can:
- Schedule property viewings
- Discuss terms & finalization
- Answer any questions about the property
- Process your offer

To connect with them, simply reply with: **"I'm ready to meet my agent"**

(Or just type something like "connect me to agent" - I'll understand!)`,
};


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

    // Every property must have an admin/agent
    if (!property.agentId) {
      throw new BadRequestException('Property has no assigned admin');
    }

    const agentId = property.agentId;

    // If VA chat (default), agentId stays null

    // Calculate agent fee (10% of property price)
    const agentFeePercentage = 10;
    const agentFeeTotal = (property.price * agentFeePercentage) / 100;
    const agentFeeAmount = (agentFeeTotal * 70) / 100; // Agent gets 70%

    // Create chat - FIX: Use proper conditional for optional agentId
    const chatData = {
      userId,
      propertyId,
      agentId, // 🔥 ALWAYS SET
      status: 'OPEN' as ChatStatus,
      agentFeePercentage,
      agentFeeAmount,
      agentPaymentStatus: AgentPaymentStatus.PENDING,
    };

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
    // Always start with AI system message
    await this.ensureBotUserExists();

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { firstName: true, lastName: true, phone: true },
    });

    if (!agent) throw new BadRequestException('Assigned agent not found');

    const waLink = agent?.phone ? toWhatsAppLink(agent.phone) : null;

    await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: AI_USER_ID,
        messageType: 'SYSTEM',
        message: [
          `✅ Reservation confirmed for **${property.title}**.`,
          `👤 Assigned Agent: ${agent.firstName} ${agent.lastName}`,
          `📞 WhatsApp: ${waLink ?? 'N/A'}`,
          ``,
          `Reply: **INSPECT TODAY** / **INSPECT TOMORROW** / **PICK DATE**`,
        ].join('\n'),
      },
    });

    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { vaStage: 'POST_PAYMENT_INIT' },
    });

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
      const created = await this.createChat({ propertyId } as any, userId);
      chat = await this.prisma.chat.findUnique({
        where: { id: created.chat.id },
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
      // ✅ now chat is assigned properly
    }

    // 3) Soft-hold property for 15 mins
    const updatedProperty = await this.itemsService.softHoldForChat(
      propertyId,
      userId,
    );

    return { chat, property: updatedProperty };
  }

  private async handlePostPaymentVa(
    chatId: string,
    userId: string,
    text: string,
  ) {
    await this.ensureBotUserExists();

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        property: { select: { id: true, title: true, agentId: true } },
      },
    });

    if (!chat) return;

    const msg = text.trim().toLowerCase();

    // ESCALATE always works
    if (msg.includes('escalate')) {
      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: AI_USER_ID,
          messageType: 'ADMIN_NOTIFICATION',
          message: `⚠️ User requested ESCALATION for chat ${chatId}. Please follow up immediately.`,
          metadata: { chatId, userId, reason: 'ESCALATE' },
        },
      });

      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: AI_USER_ID,
          messageType: 'SYSTEM',
          message: `✅ Escalated to admin. You’ll be contacted shortly.`,
        },
      });

      return;
    }

    // Only handle scheduling in INIT stage
    if (chat.vaStage !== 'POST_PAYMENT_INIT') {
      // keep it strict
      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: AI_USER_ID,
          messageType: 'SYSTEM',
          message: `Reply **ESCALATE** if the agent is not responding, or **RESEND AGENT** to see the agent details again.`,
        },
      });
      return;
    }

    // parse inspection intent
    let chosen = '';

    if (msg.includes('today')) chosen = 'TODAY';
    else if (msg.includes('tomorrow')) chosen = 'TOMORROW';
    else if (msg.includes('pick date') || msg.includes('date'))
      chosen = 'PICK_DATE';

    if (!chosen) {
      await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: AI_USER_ID,
          messageType: 'SYSTEM',
          message: `Reply: **INSPECT TODAY** / **INSPECT TOMORROW** / **PICK DATE**`,
        },
      });
      return;
    }

    await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: AI_USER_ID,
        messageType: 'SYSTEM',
        message:
          chosen === 'PICK_DATE'
            ? `✅ Noted. Reply with your preferred inspection date and time (e.g., “Feb 2, 3pm”).`
            : `✅ Noted. I’ve sent your inspection request (**${chosen}**) to the assigned agent. If they don’t respond within 30 minutes, reply **ESCALATE**.`,
        metadata: { inspectionChoice: chosen },
      },
    });

    // If TODAY/TOMORROW, mark scheduled stage immediately
    if (chosen !== 'PICK_DATE') {
      await this.prisma.chat.update({
        where: { id: chatId },
        data: { vaStage: 'POST_PAYMENT_SCHEDULED' },
      });
    }
  }

  /**
   * Handle message during AI phase - AI agent responds to user
   */
  async handleMessageWithAIAgent(
    chatId: string,
    userId: string,
    userMessage: string,
  ): Promise<any> {
    // 0) Load chat (so we can use chat.id safely)
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
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

    if (!chat) throw new NotFoundException('Chat not found');

    // 1) Unlock keyword -> transfer
    if (this.detectUnlockKeyword(userMessage)) {
      return await this.transferToRealAgent(chatId, userId, userMessage);
    }

    // 2) If AI phase not started, start it + greet once
    if (!chat.aiPhaseStartedAt) {
      await this.ensureBotUserExists();

      await this.prisma.chatMessage.create({
        data: {
          chatId: chat.id,
          senderId: AI_USER_ID,
          message: AI_GREETING_RESPONSES.greeting,
          messageType: 'SYSTEM', // in your schema this exists. Don't use TEXT here.
        },
      });

      await this.prisma.chat.update({
        where: { id: chat.id },
        data: {
          aiPhaseStartedAt: new Date(),
          aiConversationCount: 1,
        },
      });

      // After greeting, stop here (user can reply next)
      return { success: true, greeted: true };
    }

    // 3) Generate AI response (call your existing chatService.sendMessage for now)
    const context = chat.property
      ? `Property context:
Title: ${chat.property.title}
Price: ₦${chat.property.price}
Location: ${chat.property.location}
Category: ${chat.property.category}

Keep reply short, helpful, and Nigerian context.`
      : undefined;

    const groq = await this.chatService.sendMessage([
      ...(context ? [{ role: 'system', content: context }] : []),
      { role: 'user', content: userMessage },
    ]);

    const aiText = groq?.message || "I'm here—how can I help?";

    await this.ensureBotUserExists();

    // 4) Save AI response to chat_messages
    await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: AI_USER_ID,
        senderType: 'AI_AGENT', // optional, but matches your schema
        message: aiText,
        messageType: 'SYSTEM',
        isAiGenerated: true,
        aiConfidenceScore: null,
        metadata: { mode: 'AI_PHASE' },
      },
    });

    // 5) Update chat AI counters
    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { aiConversationCount: { increment: 1 } },
    });

    return { success: true };
  }

  /**
   * Check expired reservations (run via scheduled job)
   */
  async checkExpiredReservations(): Promise<void> {
    try {
      const now = new Date();

      const expiredReservations =
        await this.prisma.reservationFeePayment.findMany({
          where: {
            expiresAt: { lt: now },
            isExpired: false,
          },
        });

      for (const reservation of expiredReservations) {
        // Mark as expired
        await this.prisma.reservationFeePayment.update({
          where: { id: reservation.id },
          data: {
            isExpired: true,
            expiredAt: now,
          },
        });

        // Send system message to user in chat
        if (reservation.chatId) {
          await this.ensureBotUserExists();
          await this.prisma.chatMessage.create({
            data: {
              chatId: reservation.chatId,
              senderId: AI_USER_ID,
              message:
                'Your reservation has expired. The ₦10,000 fee is non-refundable. You can reserve another property or contact support.',
              messageType: 'SYSTEM',
            },
          });

          // Update chat status
          await this.prisma.chat.update({
            where: { id: reservation.chatId },
            data: {
              isReservationExpired: true,
              reservationExpiredAt: now,
            },
          });
        }

        // Release property
        await this.prisma.item.update({
          where: { id: reservation.propertyId },
          data: {
            isReserved: false,
            currentReservationBy: null,
          },
        });
      }
    } catch (error) {
      console.error('Error checking expired reservations:', error);
    }
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
    await this.prisma.chatMessage.updateMany({
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
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }});
    if (!chat) throw new NotFoundException('Chat not found');

    // Verify sender exists and get role
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!sender) throw new NotFoundException('Sender not found');

    // Prevent SUPER_ADMIN from sending messages
    if (sender.role === Role.SUPER_ADMIN) {
    throw new ForbiddenException('Super admin can only view chats');
  }

    // Check authorization
    if (chat.userId !== userId && chat.agentId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    //  BLOCK AGENT DURING AI PHASE (before saving anything)
    const isAgent = chat.agentId === userId;
    if (isAgent && !chat.aiPhaseEndedAt) {
      throw new BadRequestException('Wait until AI transfers the user to you');
    }

    // Create message
    const newMessage = await this.prisma.chatMessage.create({
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

    // NEW: If user message AND chat is in AI phase, let AI respond
    const isUserMessage = chat.userId === userId;

    // AI should respond if AI phase not ended
    const shouldUseAI = !chat.aiPhaseEndedAt;

    if (isUserMessage && shouldUseAI) {
      await this.handleMessageWithAIAgent(chatId, userId, message);
    }

    if (chat.agentId === userId && !chat.aiPhaseEndedAt) {
      throw new BadRequestException('Wait until AI transfers the user to you');
    }
    // Update chat stats (existing logic)
    const isAgentUser = chat.agentId === userId;
    if (isAgentUser) {
      const updateData: any = {
        lastAgentResponseAt: new Date(),
        agentResponseCount: { increment: 1 },
        status: 'ACTIVE' as ChatStatus,
      };

      if (!chat.firstAgentResponseAt) {
        updateData.firstAgentResponseAt = new Date();
        const responseTime = Math.round(
          (new Date().getTime() - chat.createdAt.getTime()) / (1000 * 60),
        );
        updateData.averageResponseTimeMinutes = responseTime;

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

      await this.prisma.agentActivityLog.create({
        data: {
          chatId,
          agentId: userId,
          actionType: 'MESSAGE_SENT',
          metadata: { messageId: newMessage.id },
        },
      });
    } else {
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

  private async ensureBotUserExists() {
    const botId = AI_USER_ID;

    const existing = await this.prisma.user.findUnique({
      where: { id: botId },
      select: { id: true },
    });

    if (existing) return;

    const passwordHash = await bcrypt.hash(
      process.env.AI_BOT_PASSWORD || 'BOT_ACCOUNT_DO_NOT_LOGIN',
      10,
    );

    await this.prisma.user.create({
      data: {
        id: botId,
        email: 'bot@h12homes.ai',
        password: passwordHash,
        firstName: 'H12',
        lastName: 'Assistant',
        role: 'USER',
        isEmailVerified: true,
        isAgent: false,
        isInventor: false,
        isFurnitureMaker: false,
      },
    });

    console.log('✅ AI bot user created in DB:', botId);
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
      await this.ensureBotUserExists();
      const saved = await this.prisma.chatMessage.create({
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
      console.error('❌ generateVaReply FAILED:, e?.message || e');
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
    return this.prisma.chatMessage.findMany({
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

  private detectUnlockKeyword(message: string): boolean {
    const lower = message.toLowerCase().trim();
    return AI_UNLOCK_KEYWORDS.some((kw) => lower.includes(kw));
  }

  private async transferToRealAgent(
    chatId: string,
    userId: string,
    userKeyword: string,
  ) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');

    await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        aiPhaseEndedAt: new Date(),
        aiUnlockKeywordUsed: userKeyword,
        agentPhaseStartedAt: new Date(),
      },
    });

    await this.ensureBotUserExists();
    await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: AI_USER_ID,
        senderType: 'AI_AGENT',
        message: '✅ Perfect! Connecting you with your agent...',
        messageType: 'SYSTEM',
      },
    });

    return { success: true, transferredToAgent: true };
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

    await this.prisma.chatMessage.create({
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
    await this.prisma.chatMessage.create({
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
