import { IsEnum } from 'class-validator';
import { LandlordVerificationStatus } from '@prisma/client';

export class ReviewLandlordDto {
  @IsEnum(LandlordVerificationStatus)
  status: LandlordVerificationStatus;
}
