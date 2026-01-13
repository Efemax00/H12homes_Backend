// src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, EngagementType } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // ==================== VIEW TRACKING ====================

  /**
   * Track property view (public endpoint)
   * POST /analytics/track-view/:propertyId
   */
  @Post('track-view/:propertyId')
  async trackView(
    @Param('propertyId') propertyId: string,
    @Req() req,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
    @Body('sessionId') sessionId?: string,
  ) {
    const userId = req.user?.id; // Optional - user might not be logged in

    return this.analyticsService.trackView(
      propertyId,
      userId,
      ipAddress,
      userAgent,
      referrer,
      sessionId,
    );
  }

  /**
   * Track engagement action
   * POST /analytics/track-engagement
   */
  @Post('track-engagement')
  async trackEngagement(
    @Req() req,
    @Body()
    body: {
      propertyId: string;
      actionType: EngagementType;
      metadata?: any;
    },
  ) {
    const userId = req.user?.id;

    return this.analyticsService.trackEngagement(
      body.propertyId,
      body.actionType,
      userId,
      body.metadata,
    );
  }

  // ==================== ANALYTICS VIEWING ====================

  /**
   * Get property analytics (Admin who owns it or SUPER_ADMIN)
   * GET /analytics/property/:propertyId
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('property/:propertyId')
  async getPropertyAnalytics(
    @Req() req,
    @Param('propertyId') propertyId: string,
  ) {
    // Verify admin owns this property (unless SUPER_ADMIN)
    if (req.user.role !== Role.SUPER_ADMIN) {
      const property = await this.analyticsService['prisma'].item.findFirst({
        where: {
          id: propertyId,
          createdBy: req.user.id,
        },
      });

      if (!property) {
        throw new Error('Not your property');
      }
    }

    return this.analyticsService.getPropertyAnalytics(propertyId);
  }

  /**
   * Get admin's analytics (their properties)
   * GET /analytics/my-performance
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('my-performance')
  async getMyAnalytics(@Req() req) {
    if (req.user.role === Role.SUPER_ADMIN) {
      // Super admin sees platform-wide
      return this.analyticsService.getPlatformAnalytics();
    }
    // Regular admin sees only their properties
    return this.analyticsService.getAdminAnalytics(req.user.id);
  }

  /**
   * Get platform analytics (SUPER_ADMIN only)
   * GET /analytics/platform
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('platform')
  async getPlatformAnalytics() {
    return this.analyticsService.getPlatformAnalytics();
  }

  /**
   * Detect suspicious activity (SUPER_ADMIN only)
   * GET /analytics/suspicious/:propertyId
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('suspicious/:propertyId')
  async detectSuspiciousActivity(@Param('propertyId') propertyId: string) {
    return this.analyticsService.detectSuspiciousActivity(propertyId);
  }

  /**
   * Force update property counters (Admin only)
   * POST /analytics/update-counters/:propertyId
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('update-counters/:propertyId')
  async updateCounters(@Param('propertyId') propertyId: string) {
    return this.analyticsService.updatePropertyCounters(propertyId);
  }
}