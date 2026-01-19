import { IsOptional, IsString, IsEnum } from 'class-validator';
import { LandlordVerificationStatus } from '@prisma/client';

export class UpdateLandlordDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsEnum(LandlordVerificationStatus)
  verificationStatus?: LandlordVerificationStatus;

  @IsOptional()
  @IsString()
  nationalIdUrl?: string;

  @IsOptional()
  @IsString()
  utilityBillUrl?: string;

  @IsOptional()
  @IsString()
  cacDocUrl?: string;
}
