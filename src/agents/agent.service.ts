import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentStatistics } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get agent statistics and performance metrics
   */
  async getAgentStatistics(agentId: string) {
    const stats = await this.prisma.agentStatistics.findUnique({
      where: { agentId },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    if (!stats) {
      throw new NotFoundException('Agent statistics not found');
    }

    return {
      ...stats,
      performanceRating: this.calculatePerformanceRating(stats),
      statusMessage: this.getStatusMessage(stats),
    };
  }

  /**
   * Get agent activity log
   */
  async getAgentActivityLog(
    agentId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.agentActivityLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        chat: {
          select: {
            id: true,
            property: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get low-performing agents
   */
  async getLowPerformingAgents(minRating: number = 2.5, minChats: number = 5) {
    return this.prisma.agentStatistics.findMany({
      where: {
        AND: [
          { totalChatsAssigned: { gte: minChats } },
          {
            OR: [
              { averageOverallRating: { lte: minRating } },
              { responsesAfter24Hours: { gt: 3 } },
            ],
          },
        ],
      },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { averageOverallRating: 'asc' },
    });
  }

  /**
   * Warn agent for slow responsiveness
   */
  async warnAgent(agentId: string, reason: string) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Update agent statistics
    await this.prisma.agentStatistics.update({
      where: { agentId },
      data: {
        isWarned: true,
      },
    });

    return {
      message: `Agent ${agent.firstName} ${agent.lastName} has been warned for: ${reason}`,
    };
  }

  /**
   * Ban agent
   */
  async banAgent(agentId: string, reason: string) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Ban agent
    await this.prisma.agentStatistics.update({
      where: { agentId },
      data: {
        isActive: false,
        banReason: reason,
        bannedAt: new Date(),
      },
    });

    return {
      message: `Agent ${agent.firstName} ${agent.lastName} has been banned. Reason: ${reason}`,
    };
  }

  /**
   * Unban agent
   */
  async unbanAgent(agentId: string) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    await this.prisma.agentStatistics.update({
      where: { agentId },
      data: {
        isActive: true,
        banReason: null,
        bannedAt: null,
        isWarned: false,
      },
    });

    return {
      message: `Agent ${agent.firstName} ${agent.lastName} has been unbanned`,
    };
  }

  /**
   * Get all agents with statistics
   */
  async getAllAgents(includeInactive: boolean = false) {
    return this.prisma.agentStatistics.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: { averageOverallRating: 'desc' },
    });
  }

  /**
   * Process agent payment
   */
  async processAgentPayment(chatId: string, agentId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.agentId !== agentId) {
      throw new Error('Agent mismatch');
    }

    // Mark as paid
    const updatedChat = await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        agentPaymentStatus: 'AGENT_PAID',
        agentPaidAt: new Date(),
      },
    });

    return {
      message: `Agent payment of ₦${updatedChat.agentFeeAmount?.toLocaleString()} processed`,
      agentFeeAmount: updatedChat.agentFeeAmount,
    };
  }

  /**
   * Get agent dashboard summary
   */
  async getAgentDashboard(agentId: string) {
    const stats = await this.prisma.agentStatistics.findUnique({
      where: { agentId },
    });

    const activeChats = await this.prisma.chat.count({
      where: {
        agentId,
        status: 'ACTIVE',
      },
    });

    const pendingPayments = await this.prisma.chat.count({
      where: {
        agentId,
        agentPaymentStatus: 'PAYMENT_RECEIVED',
      },
    });

    const recentRatings = await this.prisma.userRating.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      stats,
      activeChats,
      pendingPayments,
      recentRatings,
    };
  }

  /**
   * Helper: Calculate performance rating
   */
  private calculatePerformanceRating(stats: AgentStatistics): string {
    const rating = stats.averageOverallRating || 0;

    if (rating >= 4.5) return 'EXCELLENT';
    if (rating >= 4) return 'VERY_GOOD';
    if (rating >= 3) return 'GOOD';
    if (rating >= 2) return 'FAIR';
    return 'POOR';
  }

  /**
   * Helper: Get status message
   */
  private getStatusMessage(stats: AgentStatistics): string {
    if (!stats.isActive) return `BANNED: ${stats.banReason}`;
    if (stats.isWarned) return 'WARNING: Slow response times';
    if (stats.responsesAfter24Hours > 5) return 'WARNING: Multiple late responses';
    return 'ACTIVE';
  }
}