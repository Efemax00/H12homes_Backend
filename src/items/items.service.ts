import { Injectable, ForbiddenException } from '@nestjs/common';
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

  async getAllItemsWithAdmin() {
  return this.prisma.item.findMany({
    include: {
      images: true,
      createdByUser: { // ✅ Include admin who posted it
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