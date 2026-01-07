import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { IsStrongPassword } from '../validators/password-strength.validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  location?: string; 
}
