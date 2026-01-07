import { IsString, IsNumber, IsOptional, IsEnum, Min, IsBoolean, IsInt } from 'class-validator';
import { ItemStatus } from '@prisma/client';

export class CreateItemDto {
  @IsString()
  title: string;

  @IsString()
  shortDesc: string;

  @IsString()
  longDesc: string;

  @IsOptional()
  @IsString()
  dos?: string;

  @IsOptional()
  @IsString()
  donts?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // New fields
  @IsOptional()
  @IsInt()
  @Min(1)
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bathrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sqft?: number;

  @IsOptional()
  @IsString()
  propertyType?: string; // "Duplex", "Apartment", "Flat", etc.
}