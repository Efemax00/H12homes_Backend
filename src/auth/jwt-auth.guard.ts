import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
