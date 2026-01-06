// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.PASSWORD_SECRET || 'supersecret', // Keep in .env
    });
  }

  async validate(payload: any) {
    // Add payload to req.user
    return { userId: payload.sub, role: payload.role };
  }
}
