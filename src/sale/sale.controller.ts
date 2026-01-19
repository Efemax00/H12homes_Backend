// src/sale/sale.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaleService } from './sale.service';
import { MarkSaleDto } from './dto/mark-sale.dto';
import { ReviewSaleDto } from './dto/review-sale.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SaleController {
  constructor(private saleService: SaleService) {}

  @Post('mark-as-sold')
  async markAsSold(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MarkSaleDto,
  ) {
    return this.saleService.markAsSold(user.id, user.role, dto);
  }

  @Post('review')
  async reviewSale(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewSaleDto,
  ) {
    return this.saleService.reviewSale(user.id, user.role, dto);
  }
}