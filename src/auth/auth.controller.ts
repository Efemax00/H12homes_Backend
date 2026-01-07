import { 
  Body, 
  Controller, 
  Post,
  Req,
  UsePipes, 
  ValidationPipe,
  UseGuards 
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';
import express from 'express';
import { ForgotPasswordDto } from 'src/dto/forgot-password.dto';
import { ResetPasswordDto } from 'src/dto/reset-password.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @Throttle({ short: { limit: 3, ttl: 1000 }, long: { limit: 5, ttl: 900000 } })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  signup(@Body() body: SignupDto) {
    return this.auth.signup(body);
  }

  @Post('login')
@Throttle({ short: { limit: 5, ttl: 60000 } })
@UsePipes(new ValidationPipe({ whitelist: true }))
async login(@Body() body: LoginDto, @Req() req: express.Request) {
  const ip = req.ip || req.socket.remoteAddress;
  return this.auth.login(body.email, body.password, ip);
}

  @Post('refresh')
@UsePipes(new ValidationPipe({ whitelist: true }))
async refresh(@Body() body: RefreshTokenDto) {
  return this.auth.refreshAccessToken(body.refreshToken);
}

@Post('logout')
@UsePipes(new ValidationPipe({ whitelist: true }))
async logout(@Body() body: RefreshTokenDto) {
  await this.auth.logout(body.refreshToken);
  return { message: 'Logged out successfully' };
}

@Post('forgot-password')
@Throttle({ short: { limit: 1, ttl: 60000 } }) // 1 request per minute
@UsePipes(new ValidationPipe({ whitelist: true }))
async forgotPassword(@Body() body: ForgotPasswordDto) {
  return this.auth.requestPasswordReset(body.email);
}

@Post('reset-password')
@Throttle({ short: { limit: 3, ttl: 60000 } })
@UsePipes(new ValidationPipe({ whitelist: true }))
async resetPassword(@Body() body: ResetPasswordDto) {
  return this.auth.resetPassword(body.token, body.newPassword);
}
}