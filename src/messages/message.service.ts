// src/messages/messages.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageType, InterestStatus, ItemStatus, Prisma } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // ==================== INTEREST TRACKING ====================

  /**
   * User clicks "I'm Interested" button
   * Creates interest record and audit log
   */
  async expressInterest(userId: string, propertyId: string) {
    // 1. Check if property exists
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      include: { createdByUser: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Prevent interest if property is SOLD or RENTED
    if (
      property.status === ItemStatus.SOLD ||
      property.status === ItemStatus.RENTED
    ) {
      throw new ForbiddenException(
        'This property is not accepting new interests at the moment.',
      );
    }

    // Prevent admin from expressing interest in their own property
    if (property.createdBy === userId) {
      throw new BadRequestException(
        'Cannot express interest in your own property',
      );
    }

    // 2. Check if interest already exists
    const existingInterest = await this.prisma.propertyInterest.findUnique({
      where: {
        propertyId_userId: {
          propertyId,
          userId,
        },
      },
    });

    let interest;

    if (existingInterest) {
      // ♻️ Just reactivate / bump timestamp – NO new system messages
      interest = await this.prisma.propertyInterest.update({
        where: {
          propertyId_userId: {
            propertyId,
            userId,
          },
        },
        data: {
          status: InterestStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });
    } else {
      // ✨ First time: create interest
      interest = await this.prisma.propertyInterest.create({
        data: {
          propertyId,
          userId,
          status: InterestStatus.ACTIVE,
        },
      });

      // 3a. Notify admin (only if property has an owner)
      if (property.createdBy) {
        this.prisma.propertyChatMessage.create({
          data: {
            propertyId,
            senderId: userId,
            receiverId: property.createdBy,
            message: '🔔 New buyer expressed interest in your property!',
            messageType: MessageType.SYSTEM,
          },
        });
      }

      // 3b. Send payment details to user in the chat (optional but cool)
      const {
        COMPANY_BANK_NAME,
        COMPANY_ACCOUNT_NAME,
        COMPANY_ACCOUNT_NUMBER,
        COMPANY_PAYMENT_INSTRUCTIONS,
      } = process.env;

      if (COMPANY_BANK_NAME && COMPANY_ACCOUNT_NAME && COMPANY_ACCOUNT_NUMBER) {
        // Sender can be the admin (if exists) or the user themselves, but it's a SYSTEM message anyway
        const senderId = property.createdBy ?? userId;

        const paymentMessage =
          `💳 Payment Details\n` +
          `Bank: ${COMPANY_BANK_NAME}\n` +
          `Account Name: ${COMPANY_ACCOUNT_NAME}\n` +
          `Account Number: ${COMPANY_ACCOUNT_NUMBER}\n` +
          (COMPANY_PAYMENT_INSTRUCTIONS
            ? `\nNote: ${COMPANY_PAYMENT_INSTRUCTIONS}`
            : '');

        await this.prisma.propertyChatMessage.create({
          data: {
            propertyId,
            senderId,
            receiverId: userId,
            message: paymentMessage,
            messageType: MessageType.SYSTEM,
          },
        });
      }
    }

    // 4. Audit log (we can log every click; we also tell if it's first time)
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CLICKED_INTERESTED',
        entityType: 'PROPERTY',
        entityId: propertyId,
        metadata: {
          propertyTitle: property.title,
          sellerId: property.createdBy,
          isFirstTime: !existingInterest,
        },
      },
    });

    return interest;
  }

  /**
   * Get all users interested in a property (for admin)
   */
  async getPropertyInterests(propertyId: string, adminId: string) {
    // Verify admin owns this property
    const property = await this.prisma.item.findFirst({
      where: {
        id: propertyId,
        createdBy: adminId,
      },
    });

    if (!property) {
      throw new ForbiddenException('Not your property');
    }

    return this.prisma.propertyInterest.findMany({
      where: { propertyId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user's interests (properties they inquired about)
   */
  async getUserInterests(userId: string) {
    const interests = await this.prisma.propertyInterest.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: true,
            location: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get last message and unread count for each conversation
    const conversationsWithMessages = await Promise.all(
      interests.map(async (interest) => {
        // ✅ FIX: Only get messages between THIS user and the admin
        const lastMessage = await this.prisma.propertyChatMessage.findFirst({
  where: {
    propertyId: interest.propertyId,
    OR: [{ senderId: userId }, { receiverId: userId }],
  },
  orderBy: { createdAt: 'desc' },
  select: { message: true, createdAt: true },
});


        const unreadCount = await this.prisma.propertyChatMessage.count({
          where: {
            propertyId: interest.propertyId,
            receiverId: userId,
            isRead: false,
          },
        });

        return {
          propertyId: interest.propertyId,
          status: interest.status,
          createdAt: interest.createdAt,
          updatedAt: interest.updatedAt,
          property: interest.property,
          lastMessage: lastMessage?.message || null,
          lastMessageAt: lastMessage?.createdAt || interest.createdAt,
          unreadCount,
        };
      }),
    );

    return conversationsWithMessages;
  }

  /**
   * Get user's conversations (wrapper for getUserInterests)
   * Used by the frontend "messages" / header for logged-in users
   */
  async getUserConversations(userId: string) {
    return this.getUserInterests(userId);
  }

  // ==================== CHAT MESSAGES ====================

  /**
   * ✅ FIXED: Send a message in property chat (bidirectional)
   */
  async sendMessage(
    senderId: string,
    propertyId: string,
    message: string,
    messageType: MessageType = MessageType.TEXT,
    attachmentUrl?: string,
  ) {
    // Get property to find owner
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: { createdBy: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (!property.createdBy) {
      throw new NotFoundException('Property has no owner');
    }

    let receiverId: string;

    // ✅ BIDIRECTIONAL LOGIC:
    if (senderId === property.createdBy) {
      // Admin is sending → find the buyer
      // Get the interest record to find who the buyer is
      const interest = await this.prisma.propertyInterest.findFirst({
        where: { propertyId },
        select: { userId: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!interest) {
        throw new NotFoundException('No interested buyer found');
      }

      receiverId = interest.userId;
    } else {
      // Buyer is sending → send to admin (property owner)
      receiverId = property.createdBy;
    }

    // Create message
    const chatMessage = await this.prisma.propertyChatMessage.create({
      data: {
        propertyId,
        senderId,
        receiverId,
        message,
        messageType,
        attachmentUrl,
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

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: senderId,
        action: 'SENT_MESSAGE',
        entityType: 'MESSAGE',
        entityId: chatMessage.id,
        metadata: {
          propertyId,
          receiverId,
          messageType,
        },
      },
    });

    return chatMessage;
  }

  /**
   * ✅ FIXED: Get chat history ONLY between the current user and the other party
   */
  async getChatHistory(propertyId: string, userId: string) {
    // Verify user is either the buyer or the seller
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: { createdBy: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const interest = await this.prisma.propertyInterest.findFirst({
      where: {
        propertyId,
        userId,
      },
    });

    // User must be either interested buyer or the seller
    if (!interest && property.createdBy !== userId) {
      throw new ForbiddenException('Not authorized to view this chat');
    }

    // ✅ FIX: Only get messages where current user is sender OR receiver
    const messages = await this.prisma.propertyChatMessage.findMany({
      where: {
        propertyId,
        OR: [{ senderId: userId }, { receiverId: userId }],
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
      orderBy: { createdAt: 'asc' },
    });

    // Mark messages as read if user is receiver
    await this.prisma.propertyChatMessage.updateMany({
      where: {
        propertyId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return messages;
  }

  /**
   * ✅ FIXED: Get all conversations for an admin (their properties only, grouped by buyer)
   */
  async getAdminConversations(adminId: string) {
    // 1. Get property IDs created by this admin
    const properties = await this.prisma.item.findMany({
      where: { createdBy: adminId },
      select: { id: true, title: true, price: true, images: true },
    });

    if (!properties.length) {
      return [];
    }

    const propertyIds = properties.map((p) => p.id);

    // 2. Get all interests for admin's properties
    const interests = await this.prisma.propertyInterest.findMany({
      where: {
        propertyId: { in: propertyIds },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            title: true,
            price: true,
            images: true,
          },
        },
      },
    });

    // 3. For each interest, get the last message and unread count
    const conversations = await Promise.all(
      interests.map(async (interest) => {
        // Get last message between admin and THIS specific buyer
        const lastMessage = await this.prisma.propertyChatMessage.findFirst({
          where: {
            propertyId: interest.propertyId,
            OR: [
              { senderId: adminId, receiverId: interest.userId },
              { senderId: interest.userId, receiverId: adminId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            message: true,
            createdAt: true,
          },
        });

        // Get unread count from THIS buyer to admin
        const unreadCount = await this.prisma.propertyChatMessage.count({
          where: {
            propertyId: interest.propertyId,
            senderId: interest.userId,
            receiverId: adminId,
            isRead: false,
          },
        });

        return {
          propertyId: interest.propertyId,
          propertyTitle: interest.property.title,
          price: interest.property.price,
          images: interest.property.images,
          buyerId: interest.userId,
          buyerFirstName: interest.user.firstName,
          buyerLastName: interest.user.lastName,
          buyerAvatar: interest.user.avatarUrl,
          lastMessage: lastMessage?.message || null,
          lastMessageAt: lastMessage?.createdAt || interest.createdAt,
          unreadCount,
        };
      }),
    );

    // Sort by last message time (most recent first)
    return conversations.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
  }

  /**
   * Get all conversations platform-wide (SUPER_ADMIN only)
   */
  async getAllConversations() {
    return this.prisma.propertyChatMessage.findMany({
      distinct: ['propertyId'],
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            images: true,
          },
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== SALES & MARKING ====================

  /**
   * Admin marks property as SOLD or RENTED to a specific buyer
   */
  async markAsSold(
    adminId: string,
    propertyId: string,
    buyerId: string,
    amount: number,
    paymentProofUrl?: string,
    mode: 'SALE' | 'RENT' = 'SALE',
    rentDurationMonths?: number,
    notes?: string,
  ) {
    // 1. Verify admin owns this property
    const property = await this.prisma.item.findFirst({
      where: {
        id: propertyId,
        createdBy: adminId,
      },
      select: {
        id: true,
        category: true,
        itemType: true,
        propertyType: true,
        status: true,
      },
    });

    if (!property) {
      throw new ForbiddenException('Not your property');
    }

    // 2. Verify buyer exists
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    // 3. Business rules

    // Items that should ALWAYS remain available (can be sold/rented many times)
    const isAlwaysAvailable =
      property.itemType === 'HOUSEHOLD_ITEM' ||
      property.category === 'SHORT_STAY' ||
      property.propertyType === 'APARTMENT' ||
      property.propertyType === 'HOTEL';

    // Long-term RENT: normal house, FOR_RENT, mode = RENT, not in always-available group
    const isRental =
      !isAlwaysAvailable &&
      property.category === 'FOR_RENT' &&
      property.itemType === 'HOUSE' &&
      mode === 'RENT';

    // 4. Compute rental dates if this is a rental
    let rentalMonthsToUse: number | null = null;
    let rentStart: Date | null = null;
    let rentEnd: Date | null = null;

    if (isRental) {
      rentalMonthsToUse = rentDurationMonths ?? 12; // default 12 months
      rentStart = new Date();
      rentEnd = new Date(rentStart);
      rentEnd.setMonth(rentEnd.getMonth() + rentalMonthsToUse);
    }

    // 5. Create sale / rental record
    const sale = await this.prisma.sale.create({
      data: {
        propertyId,
        buyerId,
        sellerId: adminId,
        amount,
        paymentProofUrl: paymentProofUrl ?? null,
        notes: notes ?? null,

        // basic manual flow: payment submitted, waiting finance confirmation
        status: 'PAYMENT_SUBMITTED',
        companyAccountPaid: false,
        markedSoldAt: new Date(),

        // rental info
        isRental,
        rentalMonths: rentalMonthsToUse,
        rentalStartDate: rentStart,
        rentalEndDate: rentEnd,
      },
    });

    // 6. Update property status based on rules
    const itemUpdateData: Prisma.ItemUpdateInput = {};  // ✅ Type-safe!

    if (isAlwaysAvailable) {
      // Household items, hotels, apartments, short-stay:
      // ✅ remain AVAILABLE; no status change
    } else if (isRental) {
      // Long-term rent: block it for that period
      itemUpdateData.status = ItemStatus.RENTED;
      itemUpdateData.rentStartDate = rentStart;
      itemUpdateData.rentEndDate = rentEnd;
      itemUpdateData.rentDurationMonths = rentalMonthsToUse;
      itemUpdateData.autoReopenAt = rentEnd;
    } else {
      // Outright sale: property is gone
      itemUpdateData.status = ItemStatus.SOLD;
    }

    if (Object.keys(itemUpdateData).length > 0) {
      await this.prisma.item.update({
        where: { id: propertyId },
        data: itemUpdateData,
      });
    }

    // 7. Update interests
    await this.prisma.propertyInterest.updateMany({
      where: {
        propertyId,
        userId: buyerId,
      },
      data: { status: InterestStatus.PURCHASED },
    });

    await this.prisma.propertyInterest.updateMany({
      where: {
        propertyId,
        userId: { not: buyerId },
        status: InterestStatus.ACTIVE,
      },
      data: { status: InterestStatus.EXPIRED },
    });

    // 8. Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: isRental ? 'MARKED_RENTED' : 'MARKED_SOLD',
        entityType: 'PROPERTY',
        entityId: propertyId,
        metadata: {
          buyerId,
          amount,
          saleId: sale.id,
          isRental,
          rentalMonths: rentalMonthsToUse,
          rentEndDate: rentEnd,
        },
      },
    });

    // 9. Notify buyer via system message
    await this.prisma.propertyChatMessage.create({
      data: {
        propertyId,
        senderId: adminId,
        receiverId: buyerId,
        message: isRental
          ? '🏠 Your rent has been confirmed for this property.'
          : '🎉 Congratulations! This property has been marked as SOLD to you. Our finance team will verify your payment shortly.',
        messageType: MessageType.SYSTEM,
      },
    });

    return sale;
  }

  /**
   * Get admin's sales history
   */
  async getAdminSales(adminId: string) {
    return this.prisma.sale.findMany({
      where: { sellerId: adminId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            images: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all sales platform-wide (SUPER_ADMIN only)
   */
  async getAllSales() {
    return this.prisma.sale.findMany({
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Get audit logs (SUPER_ADMIN only)
   */
  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {};  // ✅ Type-safe!

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate,
      };
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit for performance
    });
  }
}