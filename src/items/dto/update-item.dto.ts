import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { ItemStatus } from '@prisma/client';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  shortDesc?: string;

  @IsOptional()
  @IsString()
  longDesc?: string;

  @IsOptional()
  @IsString()
  dos?: string;

  @IsOptional()
  @IsString()
  donts?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  status?: ItemStatus;

// Landlord Information
   @IsOptional()
  @IsString()
  landlordFullName?: string;

  @IsOptional()
  @IsString()
  landlordPhone?: string;

  @IsOptional()
  @IsString()
  landlordEmail?: string;

  @IsOptional()
  @IsString()
  landlordAddress?: string;

  @IsOptional()
  @IsString()
  landlordBankName?: string;

  @IsOptional()
  @IsString()
  landlordAccountNumber?: string;

  @IsOptional()
  @IsString()
  landlordAccountName?: string;
}
