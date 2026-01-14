// src/messages/messages.service.ts
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageType, InterestStatus } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // ==================== INTEREST TRACKING ====================

  /**
   * User clicks "I'm Interested" button
   * Creates interest record and audit log
   */
  async expressInterest(userId: string, propertyId: string) {
    // Check if property exists
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      include: { createdByUser: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // ✅ Prevent admin from expressing interest in their own property
    if (property.createdBy === userId) {
      throw new BadRequestException('Cannot express interest in your own property');
    }

    // Create or update interest
    const interest = await this.prisma.propertyInterest.upsert({
      where: {
        propertyId_userId: {
          propertyId,
          userId,
        },
      },
      update: {
        status: InterestStatus.ACTIVE,
        updatedAt: new Date(),
      },
      create: {
        propertyId,
        userId,
        status: InterestStatus.ACTIVE,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CLICKED_INTERESTED',
        entityType: 'PROPERTY',
        entityId: propertyId,
        metadata: {
          propertyTitle: property.title,
          sellerId: property.createdBy,
        },
      },
    });

    // Create system message in chat (only if property has an owner)
    if (property.createdBy) {
      await this.prisma.chatMessage.create({
        data: {
          propertyId,
          senderId: userId,
          receiverId: property.createdBy,
          message: '🔔 New buyer expressed interest in your property!',
          messageType: MessageType.SYSTEM,
        },
      });
    }

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
        const lastMessage = await this.prisma.chatMessage.findFirst({
          where: {
            propertyId: interest.propertyId,
            OR: [
              { senderId: userId },
              { receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            message: true,
            createdAt: true,
          },
        });

        const unreadCount = await this.prisma.chatMessage.count({
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
      })
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
    const chatMessage = await this.prisma.chatMessage.create({
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
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        propertyId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
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
    await this.prisma.chatMessage.updateMany({
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
        const lastMessage = await this.prisma.chatMessage.findFirst({
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
        const unreadCount = await this.prisma.chatMessage.count({
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
      })
    );

    // Sort by last message time (most recent first)
    return conversations.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  /**
   * Get all conversations platform-wide (SUPER_ADMIN only)
   */
  async getAllConversations() {
    return this.prisma.chatMessage.findMany({
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
   * Admin marks property as sold to a specific buyer
   */
  async markAsSold(
    adminId: string,
    propertyId: string,
    buyerId: string,
    amount: number,
    paymentProofUrl?: string,
  ) {
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

    // Create sale record
    const sale = await this.prisma.sale.create({
      data: {
        propertyId,
        buyerId,
        sellerId: adminId,
        amount,
        paymentProofUrl,
        status: 'CONFIRMED',
        markedSoldAt: new Date(),
      },
    });

    // Update property status to SOLD
    await this.prisma.item.update({
      where: { id: propertyId },
      data: { status: 'SOLD' },
    });

    // Update buyer's interest to PURCHASED
    await this.prisma.propertyInterest.updateMany({
      where: {
        propertyId,
        userId: buyerId,
      },
      data: { status: InterestStatus.PURCHASED },
    });

    // Update other interested users to EXPIRED
    await this.prisma.propertyInterest.updateMany({
      where: {
        propertyId,
        userId: { not: buyerId },
        status: InterestStatus.ACTIVE,
      },
      data: { status: InterestStatus.EXPIRED },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'MARKED_SOLD',
        entityType: 'PROPERTY',
        entityId: propertyId,
        metadata: {
          buyerId,
          amount,
          saleId: sale.id,
        },
      },
    });

    // Notify buyer via system message
    await this.prisma.chatMessage.create({
      data: {
        propertyId,
        senderId: adminId,
        receiverId: buyerId,
        message: '🎉 Congratulations! This property has been marked as SOLD to you.',
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
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.action && { action: filters.action }),
        ...(filters?.entityType && { entityType: filters.entityType }),
        ...(filters?.startDate &&
          filters?.endDate && {
            createdAt: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          }),
      },
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