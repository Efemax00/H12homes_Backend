import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all ratings for an agent
   */
  async getAgentRatings(agentId: string) {
    const ratings = await this.prisma.userRating.findMany({
      where: { agentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
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
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const totalRatings = ratings.length;
    const avgResponsiveness = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.responsivenessRating || 0), 0) / totalRatings
      : 0;
    const avgProfessionalism = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.professionalismRating || 0), 0) / totalRatings
      : 0;
    const avgHelpfulness = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.helpfulnessRating || 0), 0) / totalRatings
      : 0;
    const avgKnowledge = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.knowledgeRating || 0), 0) / totalRatings
      : 0;
    const avgTrustworthiness = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.trustworthinessRating || 0), 0) / totalRatings
      : 0;
    const avgOverall = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.overallRating, 0) / totalRatings
      : 0;

    return {
      ratings,
      statistics: {
        totalRatings,
        averageResponsiveness: Math.round(avgResponsiveness * 10) / 10,
        averageProfessionalism: Math.round(avgProfessionalism * 10) / 10,
        averageHelpfulness: Math.round(avgHelpfulness * 10) / 10,
        averageKnowledge: Math.round(avgKnowledge * 10) / 10,
        averageTrustworthiness: Math.round(avgTrustworthiness * 10) / 10,
        averageOverall: Math.round(avgOverall * 10) / 10,
      },
    };
  }

  /**
   * Get all ratings for a specific chat
   */
  async getChatRating(chatId: string) {
    const rating = await this.prisma.userRating.findUnique({
      where: { chatId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        agent: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!rating) {
      throw new NotFoundException('Rating not found for this chat');
    }

    return rating;
  }

  /**
   * Process tip payment for agent
   */
  async processTip(chatId: string, userId: string) {
    const rating = await this.prisma.userRating.findUnique({
      where: { chatId },
    });

    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    if (rating.userId !== userId) {
      throw new BadRequestException('Only the rater can pay the tip');
    }

    if (!rating.tipAmount) {
      throw new BadRequestException('No tip amount specified');
    }

    if (rating.tipPaid) {
      throw new BadRequestException('Tip already paid');
    }

    // Mark tip as paid
    const updatedRating = await this.prisma.userRating.update({
      where: { chatId },
      data: {
        tipPaid: true,
        tipPaidAt: new Date(),
      },
    });

    // Update agent statistics
    await this.prisma.agentStatistics.update({
      where: { agentId: rating.agentId },
      data: {
        totalTipsEarned: { increment: rating.tipAmount },
      },
    });

    return {
      message: `Tip of ₦${rating.tipAmount?.toLocaleString()} successfully paid to agent`,
      rating: updatedRating,
    };
  }

  /**
   * Get top rated agents
   */
  async getTopRatedAgents(limit: number = 10) {
    const agents = await this.prisma.agentStatistics.findMany({
      where: { totalRatingsReceived: { gt: 0 } },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { averageOverallRating: 'desc' },
      take: limit,
    });

    return agents;
  }

  /**
   * Get rating summary for dashboard
   */
  async getRatingSummary() {
    const totalRatings = await this.prisma.userRating.count();
    const averageRating = await this.prisma.userRating.aggregate({
      _avg: {
        overallRating: true,
      },
    });

    const ratingDistribution = await this.prisma.userRating.groupBy({
      by: ['overallRating'],
      _count: true,
      orderBy: {
        overallRating: 'desc',
      },
    });

    return {
      totalRatings,
      averageRating: averageRating._avg.overallRating || 0,
      ratingDistribution,
    };
  }
}