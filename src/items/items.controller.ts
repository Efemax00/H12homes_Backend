import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, ItemStatus } from '@prisma/client'; // ✅ ADDED ItemStatus

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  // ============================
  // PUBLIC ROUTES
  // ============================

  @Get()
  getPublicItems() {
    return this.itemsService.getPublicItems();
  }

  // ============================
  // ADMIN ROUTES - MUST BE BEFORE :id ROUTE
  // ============================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  getAllItemsWithAdmin() {
    return this.itemsService.getAllItemsWithAdmin();
  }

  // ✅ NEW - Get items by status
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/status/:status')
  getItemsByStatus(@Param('status') status: ItemStatus) {
    return this.itemsService.getItemsByStatus(status);
  }

  // ✅ NEW - Get unfeatured items
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/unfeatured')
  getUnfeaturedItems() {
    return this.itemsService.getUnfeaturedItems();
  }

  // ✅ NEW - Get deleted items (SUPER_ADMIN only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/deleted')
  getDeletedItems() {
    return this.itemsService.getDeletedItems();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.adminUpdateItem(id, dto);
  }

  // ✅ UPDATED - Soft delete with reason
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/:id')
  adminDelete(
    @Param('id') id: string,
    @Req() req,
    @Body('reason') reason?: string,
  ) {
    return this.itemsService.adminDeleteItem(id, req.user.id, reason);
  }

  // ✅ NEW - Restore deleted item (SUPER_ADMIN only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch('admin/:id/restore')
  restoreItem(@Param('id') id: string) {
    return this.itemsService.restoreItem(id);
  }

  // ✅ NEW - Permanent delete (SUPER_ADMIN only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/:id/permanent')
  permanentDeleteItem(@Param('id') id: string) {
    return this.itemsService.permanentDeleteItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/feature')
  adminFeature(@Param('id') id: string) {
    return this.itemsService.adminFeatureItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id/unfeature')
  adminUnfeature(@Param('id') id: string) {
    return this.itemsService.adminUnfeatureItem(id);
  }

  // ============================
  // PUBLIC ROUTE - :id MUST BE AFTER admin/* routes
  // ============================

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.itemsService.getItemById(id);
  }

  // ============================
  // USER ROUTES (AUTH REQUIRED)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10))
  async create(
    @Body() dto: CreateItemDto,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    console.log('🔍 req.user:', req.user);
    console.log('🔍 req.user.id:', req.user.id);
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
    ];
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Only JPEG, PNG, and WebP images are allowed',
        );
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('Each image must be less than 5MB');
      }
    }

    const processedDto = {
      ...dto,
      price: parseFloat(dto.price as any),
      bedrooms: dto.bedrooms ? parseInt(dto.bedrooms as any) : undefined,
      bathrooms: dto.bathrooms ? parseInt(dto.bathrooms as any) : undefined,
      sqft: dto.sqft ? parseFloat(dto.sqft as any) : undefined,
    };

    return this.itemsService.createItem(processedDto, req.user.id, files);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateOwn(@Param('id') id: string, @Body() dto: UpdateItemDto, @Req() req) {
    return this.itemsService.updateOwnItem(id, dto, req.user.id);
  }
}