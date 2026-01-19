import { Role } from '@prisma/client';

export interface JwtPayload {
  id: string;        // Maps to User.id (UUID)
  email: string;     // Maps to User.email
  role: Role;        // Maps to User.role (USER | SELLER | ADMIN | SUPER_ADMIN)
}