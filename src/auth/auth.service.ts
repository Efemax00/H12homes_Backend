import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    // Uncomment this when you create the EmailService
    // private emailService: EmailService,
  ) {}

  // ==================== SIGNUP ====================
  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    phone?: string;
    location?: string;
  }): Promise<Omit<User, 'password'>> {
    const existing = await this.userService.findByEmail(data.email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Email verification tokens (optional - uncomment if you want email verification)
    // const verificationToken = randomBytes(32).toString('hex');
    // const tokenExpiresAt = new Date();
    // tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // 24 hours

    const user = await this.userService.createUser({
      ...data,
      password: hashedPassword,
      // Uncomment these if you want email verification
      // emailVerificationToken: verificationToken,
      // emailVerificationTokenExpiresAt: tokenExpiresAt,
    });

    // Send verification email (uncomment when EmailService is ready)
    // await this.emailService.sendVerificationEmail(data.email, verificationToken);

    const { password, ...result } = user;
    return result;
  }

  // ==================== EMAIL VERIFICATION ====================
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userService.findByVerificationToken(token);

    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    if (!user.emailVerificationTokenExpiresAt || new Date() > user.emailVerificationTokenExpiresAt) {
      throw new UnauthorizedException('Verification token expired');
    }

    await this.userService.verifyEmail(user.id);

    return { message: 'Email verified successfully' };
  }

  // ==================== LOGIN ====================
  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<{
    user: Omit<User, 'password'>;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
      const remainingTime = Math.ceil(
        (user.accountLockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account is locked. Try again in ${remainingTime} minutes.`,
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      // Increment failed attempts
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.userService.resetFailedLoginAttempts(user.id);

    // Generate tokens
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = await this.generateRefreshToken(user.id);

    const { password: _p, ...result } = user;
    return { user: result, accessToken, refreshToken };
  }

  // ==================== REFRESH TOKEN ====================
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.userService.createRefreshToken({
      token,
      userId,
      expiresAt,
    });

    return token;
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    const tokenRecord = await this.userService.findRefreshToken(refreshToken);

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      await this.userService.deleteRefreshToken(refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userService.findById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return { accessToken };
  }

  // ==================== LOGOUT ====================
  async logout(refreshToken: string): Promise<void> {
    await this.userService.deleteRefreshToken(refreshToken);
  }

  // ==================== PASSWORD RESET ====================
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return {
        message:
          'If an account exists, a password reset email has been sent',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 1); // 1 hour

    await this.userService.setPasswordResetToken(
      user.id,
      resetToken,
      tokenExpiresAt,
    );
    
    // Uncomment when EmailService is ready
    // await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: 'If an account exists, a password reset email has been sent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByPasswordResetToken(token);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (!user.passwordResetTokenExpiresAt || new Date() > user.passwordResetTokenExpiresAt) {
      throw new UnauthorizedException('Reset token expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.userService.clearPasswordResetToken(user.id);

    return { message: 'Password reset successfully' };
  }

  // ==================== FAILED LOGIN HANDLER ====================
  private async handleFailedLogin(user: User): Promise<void> {
    const newFailedAttempts = user.failedLoginAttempts + 1;

    if (newFailedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MS);
      await this.userService.lockAccount(user.id, lockoutUntil);
    } else {
      await this.userService.incrementFailedLoginAttempts(user.id);
    }
  }
}