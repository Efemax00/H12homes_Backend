import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get roles from both handler (method) and class (controller)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no role restriction
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // comes from JwtAuthGuard

    // User should exist (JwtAuthGuard should catch this, but just in case)
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Check if user has one of the required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}