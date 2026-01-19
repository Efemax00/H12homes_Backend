// src/terms/terms.controller.ts
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TermsService } from './terms.service';
import { SubmitTermsDto } from './dto/submit-terms.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get('property/current')
  getCurrentPropertyTerms() {
    return this.termsService.getCurrentPropertyTerms();
  }

  @Post('property/agree')
  @UseGuards(JwtAuthGuard)
  async agreeToPropertyTerms(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitTermsDto,
  ) {
    const userId = req.user.userId;
    return this.termsService.submitPropertyTerms(userId, dto);
  }
}
