import { IsString } from 'class-validator';
import { IsStrongPassword } from '../validators/password-strength.validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}