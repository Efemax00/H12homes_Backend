import { IsString, IsNotEmpty } from 'class-validator';

export class InitializeViewingFeeDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;
}