import { IsUUID, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class MarkSaleDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  buyerId: string;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  paymentReference?: string; // bank narration, ref, etc.

  @IsOptional()
  @IsString()
  notes?: string;

  // Frontend should upload file somewhere first (e.g. Cloudinary),
  // then send the URL here
  @IsOptional()
  @IsString()
  paymentProofUrl?: string;
}
