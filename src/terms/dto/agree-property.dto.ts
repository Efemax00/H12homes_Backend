// src/terms/dto/agree-property-terms.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AgreePropertyTermsDto {
  @IsOptional()
  @IsString()
  propertyId?: string | null;

  @IsNotEmpty()
  @IsObject()
  answers!: {
    q1: string;
    q2: string;
    q3: string;
  };

  // comes from frontend as number or string → normalize to number
  @IsNotEmpty()
  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : value,
  )
  @IsNumber()
  termsVersion!: number;
}
