// src/sale/sale.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaleService } from './sale.service';
import { MarkSaleDto } from './dto/mark-sale.dto';
import { ReviewSaleDto } from './dto/review-sale.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SaleController {
  constructor(private saleService: SaleService) {}

  @Post('mark-as-sold')
  async markAsSold(@Req() req, @Body() dto: MarkSaleDto) {
    const user = req.user as { id: string; role: any };
    return this.saleService.markAsSold(user.id, user.role, dto);
  }

  @Post('review')
  async reviewSale(@Req() req, @Body() dto: ReviewSaleDto) {
    const user = req.user as { id: string; role: any };
    return this.saleService.reviewSale(user.id, user.role, dto);
  }
}
