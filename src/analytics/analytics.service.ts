// src/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EngagementType, Prisma } from '@prisma/client';

// ✅ Define types for raw SQL query results
export interface ViewsOverTimeResult {
  date: Date;
  views: bigint;
  unique_views: bigint;
}

export interface PlatformViewsOverTimeResult {
  date: Date;
  views: bigint;
  properties_viewed: bigint;
}

export interface SuspiciousActivityResult {
  user_id: string | null;
  ip_address: string | null;
  view_count: bigint;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ==================== VIEW TRACKING ====================

  /**
   * Track property view
   * Called automatically when someone opens property details page
   */
  async trackView(
    propertyId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string,
    sessionId?: string,
  ) {
    // Record the view
    const view = await this.prisma.propertyView.create({
      data: {
        propertyId,
        userId,
        ipAddress,
        userAgent,
        referrer,
        sessionId,
      },
    });

    // Update property counters asynchronously (don't block response)
    this.updatePropertyCounters(propertyId).catch((err) =>
      console.error('Failed to update counters:', err),
    );

    return view;
  }

  /**
   * Update property view counters
   * Run periodically or after each view
   */
  async updatePropertyCounters(propertyId: string) {
    // Count total views
    const totalViews = await this.prisma.propertyView.count({
      where: { propertyId },
    });

    // Count unique views (distinct users + distinct IPs for anonymous)
    const uniqueLoggedInUsers = await this.prisma.propertyView.findMany({
      where: {
        propertyId,
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    const uniqueAnonymousIPs = await this.prisma.propertyView.findMany({
      where: {
        propertyId,
        userId: null,
        ipAddress: { not: null },
      },
      distinct: ['ipAddress'],
      select: { ipAddress: true },
    });

    const uniqueViews = uniqueLoggedInUsers.length + uniqueAnonymousIPs.length;

    // Count interested clicks
    const interestedCount = await this.prisma.propertyInterest.count({
      where: {
        propertyId,
        status: 'ACTIVE',
      },
    });

    // Count WhatsApp clicks
    const whatsappClicks = await this.prisma.propertyEngagement.count({
      where: {
        propertyId,
        actionType: EngagementType.OPENED_WHATSAPP,
      },
    });

    // Get last viewed timestamp
    const lastView = await this.prisma.propertyView.findFirst({
      where: { propertyId },
      orderBy: { viewedAt: 'desc' },
      select: { viewedAt: true },
    });

    // Update property
    await this.prisma.item.update({
      where: { id: propertyId },
      data: {
        viewCount: totalViews,
        uniqueViewCount: uniqueViews,
        interestedCount,
        whatsappClickCount: whatsappClicks,
        lastViewedAt: lastView?.viewedAt,
      },
    });

    return {
      totalViews,
      uniqueViews,
      interestedCount,
      whatsappClicks,
    };
  }

  // ==================== ENGAGEMENT TRACKING ====================

  /**
   * Track engagement action (Interested, WhatsApp, etc.)
   */
  async trackEngagement(
    propertyId: string,
    actionType: EngagementType,
    userId?: string,
    metadata?: Prisma.InputJsonValue,  // ✅ Type-safe JSON type from Prisma
  ) {
    const engagement = await this.prisma.propertyEngagement.create({
      data: {
        propertyId,
        userId,
        actionType,
        metadata,
      },
    });

    // Update counters if it's a tracked action
    if (
      actionType === EngagementType.CLICKED_INTERESTED ||
      actionType === EngagementType.OPENED_WHATSAPP
    ) {
      this.updatePropertyCounters(propertyId).catch((err) =>
        console.error('Failed to update counters:', err),
      );
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: `ENGAGEMENT_${actionType}`,
        entityType: 'PROPERTY',
        entityId: propertyId,
        metadata: metadata ? { actionType, ...(metadata as object) } : { actionType },
      },
    });

    return engagement;
  }

  // ==================== ANALYTICS & REPORTS ====================

  /**
   * Get property analytics
   */
  async getPropertyAnalytics(propertyId: string) {
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: {
        viewCount: true,
        uniqueViewCount: true,
        interestedCount: true,
        whatsappClickCount: true,
        lastViewedAt: true,
      },
    });

    // Get views over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewsOverTime = await this.prisma.$queryRaw<ViewsOverTimeResult[]>`
      SELECT 
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT COALESCE(user_id::text, ip_address)) as unique_views
      FROM property_views
      WHERE property_id = ${propertyId}
        AND viewed_at >= ${thirtyDaysAgo}
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `;

    // Get engagement breakdown
    const engagementStats = await this.prisma.propertyEngagement.groupBy({
      by: ['actionType'],
      where: { propertyId },
      _count: true,
    });

    // Get top referrers
    const topReferrers = await this.prisma.propertyView.groupBy({
      by: ['referrer'],
      where: {
        propertyId,
        referrer: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          referrer: 'desc',
        },
      },
      take: 10,
    });

    return {
      summary: property,
      viewsOverTime,
      engagementBreakdown: engagementStats,
      topReferrers,
    };
  }

  /**
   * Get admin's property performance
   */
  async getAdminAnalytics(adminId: string) {
    // Get all admin's properties
    const properties = await this.prisma.item.findMany({
      where: { createdBy: adminId },
      select: {
        id: true,
        title: true,
        viewCount: true,
        uniqueViewCount: true,
        interestedCount: true,
        whatsappClickCount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { viewCount: 'desc' },
    });

    // Calculate totals
    const totals = properties.reduce(
      (acc, prop) => ({
        totalViews: acc.totalViews + prop.viewCount,
        totalUniqueViews: acc.totalUniqueViews + prop.uniqueViewCount,
        totalInterested: acc.totalInterested + prop.interestedCount,
        totalWhatsappClicks: acc.totalWhatsappClicks + prop.whatsappClickCount,
      }),
      {
        totalViews: 0,
        totalUniqueViews: 0,
        totalInterested: 0,
        totalWhatsappClicks: 0,
      },
    );

    // Get sales count
    const salesCount = await this.prisma.sale.count({
      where: { sellerId: adminId },
    });

    // Calculate conversion rate
    const conversionRate =
      totals.totalInterested > 0
        ? (salesCount / totals.totalInterested) * 100
        : 0;

    return {
      properties,
      totals,
      salesCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  /**
   * Get platform-wide analytics (SUPER_ADMIN)
   */
  async getPlatformAnalytics() {
    // Total counts
    const [totalProperties, totalViews, totalUsers, totalSales] =
      await Promise.all([
        this.prisma.item.count({ where: { isDeleted: false } }),
        this.prisma.propertyView.count(),
        this.prisma.user.count(),
        this.prisma.sale.count(),
      ]);

    // Top performing properties
    const topProperties = await this.prisma.item.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        title: true,
        viewCount: true,
        uniqueViewCount: true,
        interestedCount: true,
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { viewCount: 'desc' },
      take: 10,
    });

    // Top performing admins
    const topAdmins = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        _count: {
          select: {
            sales: true,
            itemsCreated: true,
          },
        },
      },
      orderBy: {
        sales: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    // Views over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewsOverTime = await this.prisma.$queryRaw<PlatformViewsOverTimeResult[]>`
      SELECT 
        DATE(viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT property_id) as properties_viewed
      FROM property_views
      WHERE viewed_at >= ${thirtyDaysAgo}
      GROUP BY DATE(viewed_at)
      ORDER BY date ASC
    `;

    return {
      totals: {
        properties: totalProperties,
        views: totalViews,
        users: totalUsers,
        sales: totalSales,
      },
      topProperties,
      topAdmins,
      viewsOverTime,
    };
  }

  /**
   * Detect suspicious activity (fraud prevention)
   */
  async detectSuspiciousActivity(propertyId: string) {
    // Check for view spam (same user/IP viewing too many times)
    const recentViews = await this.prisma.$queryRaw<SuspiciousActivityResult[]>`
      SELECT 
        user_id,
        ip_address,
        COUNT(*) as view_count
      FROM property_views
      WHERE property_id = ${propertyId}::uuid
        AND viewed_at >= NOW() - INTERVAL '24 hours'
      GROUP BY user_id, ip_address
      HAVING COUNT(*) > 20
    `;

    // Check for click farming (too many interests without messages)
    const interests = await this.prisma.propertyInterest.count({
      where: { propertyId, status: 'ACTIVE' },
    });

    const messages = await this.prisma.chatMessage.count({
      where: { propertyId },
    });

    const suspiciousPatterns = {
      viewSpam: recentViews.length > 0,
      viewSpammers: recentViews,
      possibleClickFarm: interests > 10 && messages < 3,
      interestToMessageRatio: interests > 0 ? messages / interests : 0,
    };

    return suspiciousPatterns;
  }
}