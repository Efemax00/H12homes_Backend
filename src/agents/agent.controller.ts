import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AgentsService } from '../agents/agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * GET /agents/:id/statistics
   * Get agent performance statistics
   */
  @Get(':id/statistics')
  async getAgentStatistics(@Param('id') agentId: string) {
    try {
      return await this.agentsService.getAgentStatistics(agentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /agents/:id/activity-log
   * Get agent's activity log
   */
  @Get(':id/activity-log')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getAgentActivityLog(
    @Param('id') agentId: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    try {
      return await this.agentsService.getAgentActivityLog(agentId, limit, offset);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /agents/my/dashboard
   * Get agent's own dashboard
   */
  @Get('my/dashboard')
  async getMyDashboard(@CurrentUser() user: any) {
    try {
      return await this.agentsService.getAgentDashboard(user.id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /agents/:id/warn
   * Admin warns agent for slow responsiveness
   */
  @Patch(':id/warn')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async warnAgent(
    @Param('id') agentId: string,
    @Body() body: { reason: string },
  ) {
    try {
      return await this.agentsService.warnAgent(agentId, body.reason);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /agents/:id/ban
   * Admin bans agent
   */
  @Patch(':id/ban')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async banAgent(
    @Param('id') agentId: string,
    @Body() body: { reason: string },
  ) {
    try {
      return await this.agentsService.banAgent(agentId, body.reason);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /agents/:id/unban
   * Admin unbans agent
   */
  @Patch(':id/unban')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async unbanAgent(@Param('id') agentId: string) {
    try {
      return await this.agentsService.unbanAgent(agentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /agents/admin/all
   * Admin: Get all agents
   */
  @Get('admin/all')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getAllAgents(
    @Query('includeInactive') includeInactive: boolean = false,
  ) {
    try {
      return await this.agentsService.getAllAgents(includeInactive);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /agents/admin/low-performers
   * Admin: Get low-performing agents
   */
  @Get('admin/low-performers')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getLowPerformingAgents(
    @Query('minRating') minRating: number = 2.5,
    @Query('minChats') minChats: number = 5,
  ) {
    try {
      return await this.agentsService.getLowPerformingAgents(minRating, minChats);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /agents/:id/process-payment
   * Admin processes agent payment
   */
  @Patch(':id/process-payment')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async processAgentPayment(
    @Param('id') agentId: string,
    @Body() body: { chatId: string },
  ) {
    try {
      return await this.agentsService.processAgentPayment(body.chatId, agentId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}