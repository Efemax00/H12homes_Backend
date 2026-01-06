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
}
