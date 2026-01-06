import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthLogger {
  private readonly logger = new Logger('AuthService');

  logLoginAttempt(email: string, success: boolean, ip?: string): void {
    const message = success
      ? `Successful login for ${email}`
      : `Failed login attempt for ${email}`;
    
    this.logger.log(`${message} from IP: ${ip || 'unknown'}`);
  }

  logAccountLockout(email: string, ip?: string): void {
    this.logger.warn(`Account locked for ${email} from IP: ${ip || 'unknown'}`);
  }

  logSignup(email: string, ip?: string): void {
    this.logger.log(`New user registered: ${email} from IP: ${ip || 'unknown'}`);
  }

  logPasswordReset(email: string, ip?: string): void {
    this.logger.log(`Password reset requested for ${email} from IP: ${ip || 'unknown'}`);
  }

  logSuspiciousActivity(email: string, reason: string, ip?: string): void {
    this.logger.warn(
      `Suspicious activity detected for ${email}: ${reason} from IP: ${ip || 'unknown'}`,
    );
  }
}