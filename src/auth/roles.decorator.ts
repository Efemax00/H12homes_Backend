import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// This decorator is used on a route to specify allowed roles
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
