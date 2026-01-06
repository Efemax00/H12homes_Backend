import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

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

  @IsNumber()
  price: number;

  @IsString()
  location: string;
}
