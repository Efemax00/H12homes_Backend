// src/terms/terms.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { TermsService } from './terms.service';
import { AgreePropertyTermsDto } from '../terms/dto/agree-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@Controller('terms')
@UseGuards(JwtAuthGuard) // 🔐 protect both routes (frontend sends token via apiClient)
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get('property/current')
  async getCurrentPropertyTerms(
    @Req() req: AuthenticatedRequest,
    @Query('propertyId') propertyId?: string,
  ) {
    // user.id, not userId
    return this.termsService.getCurrentForProperty(req.user.id, propertyId);
  }

  @Post('property/agree')
  async agreeToPropertyTerms(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AgreePropertyTermsDto,
  ) {
    const userId = req.user.id; // ✅ FIXED
    return this.termsService.agreeForProperty(userId, dto);
  }
}
