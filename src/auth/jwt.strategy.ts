// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';

// The structure of the JWT payload when decoded
interface JwtPayloadSchema {
  sub: string;      // User ID
  email: string;    // User email
  role: Role;       // User role (USER, SELLER, ADMIN, SUPER_ADMIN)
  iat?: number;     // Issued at (added by JWT library)
  exp?: number;     // Expiration (added by JWT library)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Ensure JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      throw new Error('❌ JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayloadSchema) {
    // This return value becomes available via @CurrentUser() decorator
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}