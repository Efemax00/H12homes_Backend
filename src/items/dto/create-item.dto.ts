import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsBoolean,
  IsInt,
  IsNotEmpty,
} from 'class-validator';
import { ItemStatus, ItemCategory, ItemType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  shortDesc: string;

  @IsString()
  @IsNotEmpty()
  longDesc: string;

  @IsOptional()
  @IsString()
  dos?: string;

  @IsOptional()
  @IsString()
  donts?: string;

  // Because of form-data, price comes as string → number
  @Transform(({ value }) => (value !== undefined ? parseFloat(value) : undefined))
  @IsNumber()
  price: number;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus; // usually defaulted in service

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsEnum(ItemCategory)
  category: ItemCategory;

  @IsEnum(ItemType)
  itemType: ItemType;

  // ---------- Property details ----------

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value, 10) : undefined,
  )
  @IsOptional()
  @IsInt()
  bedrooms?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value, 10) : undefined,
  )
  @IsOptional()
  @IsInt()
  bathrooms?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseFloat(value) : undefined,
  )
  @IsOptional()
  @IsNumber()
  sqft?: number;

  // ---------- Commissions ----------

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value, 10) : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  agentCommissionPercent?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value, 10) : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  companyCommissionPercent?: number;

  @IsOptional()
  @IsString()
  propertyType?: string; // Duplex, Apartment, Flat, etc.

  // (Optional) if you want to drive rent countdown from the listing itself:
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value, 10) : undefined,
  )
  @IsOptional()
  @IsInt()
  rentDurationMonths?: number;
}
