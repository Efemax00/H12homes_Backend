// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'you fucking thief lol hahaha', // Keep in your house
    });
    console.log('🔑 JWT Strategy initialized with secret:', process.env.JWT_SECRET ? 'SECRET EXISTS' : 'NO SECRET');
  }

  async validate(payload: any) {
    // Add payload to req.user
    return { id: payload.sub,  role: payload.role };
  }
}
