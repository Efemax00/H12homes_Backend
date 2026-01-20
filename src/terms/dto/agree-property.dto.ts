import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

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

  // Use string ID, e.g. "PROPERTY_TERMS_V1"
  @IsNotEmpty()
  @IsString()
  termsVersion!: string;
}
