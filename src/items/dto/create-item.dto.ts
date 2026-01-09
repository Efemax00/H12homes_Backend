import { IsString, IsNumber, IsOptional, IsEnum,  Min, IsBoolean, IsInt, IsNotEmpty } from 'class-validator';
import { ItemStatus, ItemCategory, ItemType } from '@prisma/client';
import { Transform } from 'class-transformer'; 

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
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

  @Transform(({ value }) => parseFloat(value))  
  @IsNumber()
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

  @IsEnum(ItemCategory)
  category: ItemCategory;


  @IsEnum(ItemType)
  itemType: ItemType;

  // New fields
  @Transform(({ value }) => value ? parseInt(value) : undefined)  
  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @Transform(({ value }) => value ? parseInt(value) : undefined)  
  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @Transform(({ value }) => value ? parseFloat(value) : undefined)  
  @IsNumber()
  @IsOptional()
  sqft?: number;

  @IsOptional()
  @IsString()
  propertyType?: string; // "Duplex", "Apartment", "Flat", etc.
}