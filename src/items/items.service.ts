import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemStatus } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  // ======================
  // PUBLIC ROUTES
  // ======================

  // Homepage / Listing (featured first)
  async getPublicItems() {
    const items = await this.prisma.item.findMany({
      where: { status: ItemStatus.AVAILABLE },
      include: { images: true },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return items.map(item => this.mapItemToCompanyOwnership(item));
  }

  // Item details page (even SOLD)
  async getItemById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!item) return null;

    return this.mapItemToCompanyOwnership(item);
  }

  // Helper to replace user info with company info
  private mapItemToCompanyOwnership(item: any) {
    return {
      ...item,
      owner: {
        name: 'H12Homes',
        phone: '0800000000',
        email: 'contact@h12homes.com',
      },
    };
  }

  // ======================
  // USER ROUTES (AUTH REQUIRED)
  // ======================

  async createItem(dto: CreateItemDto, userId: string) {
    // Users submit items, but they are NOT featured
    return this.prisma.item.create({
      data: {
        ...dto,
        ownerId: userId,
        status: ItemStatus.PENDING, // submitted for admin approval
        isFeatured: false,          // cannot feature items themselves
      },
    });
  }

  async updateOwnItem(itemId: string, dto: UpdateItemDto, userId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || item.ownerId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    // Users cannot mark their own items as featured
    if ('isFeatured' in dto) delete dto.isFeatured;

    return this.prisma.item.update({ where: { id: itemId }, data: dto });
  }

  // ======================
  // ADMIN ROUTES
  // ======================

  adminUpdateItem(id: string, dto: UpdateItemDto) {
    return this.prisma.item.update({ where: { id }, data: dto });
  }

  adminDeleteItem(id: string) {
    return this.prisma.item.delete({ where: { id } });
  }

  // Only admins can feature items
  adminFeatureItem(id: string) {
    return this.prisma.item.update({
      where: { id },
      data: { isFeatured: true, status: ItemStatus.AVAILABLE },
    });
  }

  adminUnfeatureItem(id: string) {
    return this.prisma.item.update({
      where: { id },
      data: { isFeatured: false },
    });
  }
}
