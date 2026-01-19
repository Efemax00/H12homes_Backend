// src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Ip,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';
import { Role, EngagementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// ✅ Define DTO for track engagement
class TrackEngagementDto {
  propertyId: string;
  actionType: EngagementType;
  metadata?: Prisma.InputJsonValue;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private prisma: PrismaService,  // ✅ Inject Prisma directly
  ) {}

  // ==================== VIEW TRACKING ====================

  /**
   * Track property view (public endpoint)
   * POST /analytics/track-view/:propertyId
   */
  @Post('track-view/:propertyId')
  async trackView(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: JwtPayload | undefined,  // ✅ Optional user
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
    @Body('sessionId') sessionId?: string,
  ) {
    const userId = user?.id; // Optional - user might not be logged in

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
    @CurrentUser() user: JwtPayload | undefined,  // ✅ Optional user
    @Body() body: TrackEngagementDto,  // ✅ Type-safe DTO
  ) {
    const userId = user?.id;

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
    @CurrentUser() user: JwtPayload,
    @Param('propertyId') propertyId: string,
  ) {
    // Verify admin owns this property (unless SUPER_ADMIN)
    if (user.role !== Role.SUPER_ADMIN) {
      const property = await this.prisma.item.findFirst({
        where: {
          id: propertyId,
          createdBy: user.id,
        },
      });

      if (!property) {
        throw new ForbiddenException('Not your property');
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
  async getMyAnalytics(@CurrentUser() user: JwtPayload) {
    if (user.role === Role.SUPER_ADMIN) {
      // Super admin sees platform-wide
      return this.analyticsService.getPlatformAnalytics();
    }
    // Regular admin sees only their properties
    return this.analyticsService.getAdminAnalytics(user.id);
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