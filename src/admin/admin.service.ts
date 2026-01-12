// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Get all users
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        location: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        isEmailVerified: true,
        // Don't return password
      }
    });
  }

  /**
   * Update a user's role
   * Only SUPER_ADMIN can do this (enforced by guard)
   * @param userId - ID of the user to update
   * @param role - new role
   */
  async updateUserRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      }
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
      include: {
        images: true,
      }
    });
  }
}