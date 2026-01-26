import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { RatingsService } from './rating.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  /**
   * GET /ratings/agent/:id
   * Get all ratings for an agent
   */
  @Get('agent/:id')
  async getAgentRatings(@Param('id') agentId: string) {
    try {
      return await this.ratingsService.getAgentRatings(agentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /ratings/chat/:id
   * Get rating for a specific chat
   */
  @Get('chat/:id')
  async getChatRating(@Param('id') chatId: string) {
    try {
      return await this.ratingsService.getChatRating(chatId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /ratings/chat/:id/pay-tip
   * Pay tip to agent
   */
  @Post('chat/:id/pay-tip')
  async processTip(
    @Param('id') chatId: string,
    @CurrentUser() user: { id: string },
  ) {
    try {
      return await this.ratingsService.processTip(chatId, user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /ratings/top-agents
   * Get top rated agents
   */
  @Get('top-agents')
  async getTopRatedAgents(@Query('limit') limit: string = '10') {
    try {
      return await this.ratingsService.getTopRatedAgents(parseInt(limit, 10));
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /ratings/admin/summary
   * Admin: Get rating summary for dashboard
   */
  @Get('admin/summary')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getRatingSummary() {
    try {
      return await this.ratingsService.getRatingSummary();
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}