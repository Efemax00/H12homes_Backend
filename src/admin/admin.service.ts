// src/admin/admin.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Get all users
  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  /**
   * Update a user's role
   * Only SUPER_ADMIN can do this
   * @param userId - ID of the user to update
   * @param role - new role
   * @param currentUser - the user making this request
   */
  async updateUserRole(userId: string, role: Role, currentUser: User) {
    if (currentUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can change roles');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  // Feature an item
  async featureItem(itemId: string) {
    return this.prisma.item.update({
      where: { id: itemId },
      data: { isFeatured: true },
    });
  }

  // Unfeature an item
  async unfeatureItem(itemId: string) {
    return this.prisma.item.update({
      where: { id: itemId },
      data: { isFeatured: false },
    });
  }

  // Get all featured items
  async getFeaturedItems() {
    return this.prisma.item.findMany({
      where: { isFeatured: true },
    });
  }
}
