import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service'; 
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemStatus } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService, 
  ) {}

  // ======================
  // PUBLIC ROUTES
  // ======================

  // Homepage / Listing (featured first) - EXCLUDE DELETED
  async getPublicItems() {
    const items = await this.prisma.item.findMany({
      where: { 
        status: ItemStatus.AVAILABLE,
        isDeleted: false, // ✅ ADDED - Exclude deleted items
      },
      include: { images: true },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return items.map(item => this.mapItemToCompanyOwnership(item));
  }

  // Item details page (even SOLD) - EXCLUDE DELETED
  async getItemById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!item || item.isDeleted) return null; // ✅ ADDED - Return null if deleted

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

  // ✅ UPDATED - Exclude deleted items by default
  async getAllItemsWithAdmin() {
    return this.prisma.item.findMany({
      where: { isDeleted: false }, // ✅ ADDED
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  // ✅ NEW - Get items by status
  async getItemsByStatus(status: ItemStatus) {
    return this.prisma.item.findMany({
      where: { 
        status,
        isDeleted: false,
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });
  }

  // ✅ NEW - Get unfeatured items
  async getUnfeaturedItems() {
    return this.prisma.item.findMany({
      where: { 
        isFeatured: false,
        isDeleted: false,
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });
  }

  // ✅ NEW - Get deleted items (SUPER_ADMIN only)
  async getDeletedItems() {
    return this.prisma.item.findMany({
      where: { 
        isDeleted: true,
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { deletedAt: 'desc' },
      ],
    });
  }

  // ======================
  // USER ROUTES (AUTH REQUIRED)
  // ======================

  async createItem(dto: CreateItemDto, userId: string, files: Express.Multer.File[]) {
    console.log('📝 Creating item with dto:', dto);
    console.log('📝 User ID:', userId);
    console.log('📝 Files count:', files.length);
    
    const imageUrls: string[] = [];
    
    for (const file of files) {
      const url = await this.cloudinaryService.uploadPropertyImage(file);
      console.log('📸 Uploaded image:', url);
      imageUrls.push(url);
    }

    console.log('📸 All image URLs:', imageUrls);

    const item = await this.prisma.item.create({
      data: {
        ...dto,
        ownerId: userId,
        createdBy: userId,
        status: ItemStatus.PENDING,
        isFeatured: false,
        images: {
          create: imageUrls.map((url, index) => ({
            url,
            order: index,
          })),
        },
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    console.log('✅ Item created successfully:', item.id);
    return item;
  }

  async updateOwnItem(itemId: string, dto: UpdateItemDto, userId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || item.ownerId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    if (item.isDeleted) { // ✅ ADDED - Prevent updating deleted items
      throw new ForbiddenException('Cannot update deleted item');
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

  // ✅ UPDATED - Soft delete instead of hard delete
  async adminDeleteItem(id: string, adminId: string, reason?: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.isDeleted) {
      throw new ForbiddenException('Item is already deleted');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminId,
        deletionReason: reason || 'Deleted by admin',
      },
    });
  }

  // ✅ NEW - Restore deleted item (SUPER_ADMIN only)
  async restoreItem(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.isDeleted) {
      throw new ForbiddenException('Item is not deleted');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      },
    });
  }

  // ✅ NEW - Permanent delete (SUPER_ADMIN only - use with caution)
  async permanentDeleteItem(id: string) {
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