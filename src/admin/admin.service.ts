// src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async updateUserRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  // admin.service.ts
a// admin.service.ts
async featureItem(itemId: string) {
  return this.prisma.item.update({
    where: { id: itemId },
    data: { isFeatured: true },
  });
}

async unfeatureItem(itemId: string) {
  return this.prisma.item.update({
    where: { id: itemId },
    data: { isFeatured: false },
  });
}

async getFeaturedItems() {
  return this.prisma.item.findMany({
    where: { isFeatured: true },
  });
}

}
