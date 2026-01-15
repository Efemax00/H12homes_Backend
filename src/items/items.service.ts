import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemStatus, Role } from '@prisma/client';

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
    return this.prisma.item.findMany({
      where: {
        status: ItemStatus.AVAILABLE,
        isDeleted: false,
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // Item details page (even SOLD) - EXCLUDE DELETED
  async getItemById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        images: true,
        createdByUser: {
          select: {
            phone: true,
          },
        },
      },
    });

    if (!item || item.isDeleted) return null;
    return item;
  }

  // ======================
  // ADMIN LISTING QUERIES
  // ======================

  // ✅ Only my items if ADMIN, all if SUPER_ADMIN
  async getAllItemsWithAdmin(adminId: string, role: Role) {
    const where =
      role === Role.SUPER_ADMIN
        ? { isDeleted: false }
        : {
            isDeleted: false,
            createdBy: adminId,
          };

    return this.prisma.item.findMany({
      where,
      include: {
        images: true,
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ✅ Get items by status, but scoped by admin
  async getItemsByStatus(
    adminId: string,
    role: Role,
    status: ItemStatus,
  ) {
    const base: any = {
      status,
      isDeleted: false,
    };

    const where =
      role === Role.SUPER_ADMIN
        ? base
        : {
            ...base,
            createdBy: adminId,
          };

    return this.prisma.item.findMany({
      where,
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
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ✅ Get unfeatured items (scoped)
  async getUnfeaturedItems(adminId: string, role: Role) {
    const base: any = {
      isFeatured: false,
      isDeleted: false,
    };

    const where =
      role === Role.SUPER_ADMIN
        ? base
        : {
            ...base,
            createdBy: adminId,
          };

    return this.prisma.item.findMany({
      where,
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
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ✅ Deleted items (only SUPER_ADMIN hits this route anyway)
  async getDeletedItems(adminId: string, role: Role) {
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
      orderBy: [{ deletedAt: 'desc' }],
    });
  }

  // ======================
  // USER ROUTES (AUTH REQUIRED)
  // ======================

  async createItem(
    dto: CreateItemDto,
    userId: string,
    files: Express.Multer.File[],
  ) {
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

  async updateOwnItem(
    itemId: string,
    dto: UpdateItemDto,
    userId: string,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || item.ownerId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    if (item.isDeleted) {
      throw new ForbiddenException('Cannot update deleted item');
    }

    // Users cannot mark their own items as featured
    if ('isFeatured' in dto) delete (dto as any).isFeatured;

    return this.prisma.item.update({ where: { id: itemId }, data: dto });
  }

  async searchItems(
    searchQuery?: string,
    category?: string,
    itemType?: string,
    minPrice?: number,
    maxPrice?: number,
    location?: string,
  ) {
    const where: any = {
      status: ItemStatus.AVAILABLE,
      isDeleted: false,
    };

    // Text search
    if (searchQuery && searchQuery.trim()) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { shortDesc: { contains: searchQuery, mode: 'insensitive' } },
        { location: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Location filter
    if (location && location.trim()) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    // Category filter
    if (category) where.category = category;

    // Item type filter
    if (itemType) where.itemType = itemType;

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    return this.prisma.item.findMany({
      where,
      include: { images: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ======================
  // ADMIN ACTIONS
  // ======================

  // Admin update (respect ownership unless SUPER_ADMIN)
  async adminUpdateItem(
    id: string,
    dto: UpdateItemDto,
    adminId: string,
    role: Role,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException('You cannot manage another admin’s listing');
    }

    return this.prisma.item.update({ where: { id }, data: dto });
  }

  // Soft delete
  async adminDeleteItem(
    id: string,
    adminId: string,
    role: Role,
    reason?: string,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.isDeleted) {
      throw new ForbiddenException('Item is already deleted');
    }

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException('You cannot delete another admin’s listing');
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

  // Restore deleted item (SUPER_ADMIN route only, but we still guard by state)
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

  // Permanent delete (SUPER_ADMIN only)
  async permanentDeleteItem(id: string) {
    return this.prisma.item.delete({ where: { id } });
  }

  // Feature / unfeature with ownership check
  async adminFeatureItem(
    id: string,
    adminId: string,
    role: Role,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException('You cannot feature another admin’s listing');
    }

    return this.prisma.item.update({
      where: { id },
      data: { isFeatured: true, status: ItemStatus.AVAILABLE },
    });
  }

  async adminUnfeatureItem(
    id: string,
    adminId: string,
    role: Role,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException(
        'You cannot unfeature another admin’s listing',
      );
    }

    return this.prisma.item.update({
      where: { id },
      data: { isFeatured: false },
    });
  }
}
