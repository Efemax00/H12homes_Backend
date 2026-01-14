// src/sale/dto/review-sale.dto.ts
import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { FinanceStatus } from '@prisma/client';

export class ReviewSaleDto {
  @IsUUID()
  saleId: string;

  @IsEnum(FinanceStatus)
  financeStatus: FinanceStatus; // CONFIRMED or REJECTED

  @IsOptional()
  @IsString()
  financeComment?: string;
}
