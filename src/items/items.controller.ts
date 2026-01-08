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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  // ============================
  // PUBLIC ROUTES
  // ============================

  @Get()
  getPublicItems() {
    // Show all available items (featured first), no user info
    return this.itemsService.getPublicItems();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    // Show item details (even SOLD), no user info
    return this.itemsService.getItemById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/all')
  getAllItemsWithAdmin() {
    return this.itemsService.getAllItemsWithAdmin();
  }

  // ============================
  // USER ROUTES (AUTH REQUIRED)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10)) // ✅ ADDED - Allow up to 10 images
  async create(
    @Body() dto: CreateItemDto,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[], // ✅ ADDED - Handle uploaded files
  ) {
    // ✅ ADDED - Validate images
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    // ✅ ADDED - Validate file types
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

      // ✅ ADDED - Validate file size (max 5MB per image)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('Each image must be less than 5MB');
      }
    }

    // Users submit items, will NOT be featured
    return this.itemsService.createItem(dto, req.user.id, files); // ✅ UPDATED - Pass files
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateOwn(@Param('id') id: string, @Body() dto: UpdateItemDto, @Req() req) {
    // Users can update only their own items
    return this.itemsService.updateOwnItem(id, dto, req.user.id);
  }

  // ============================
  // ADMIN ROUTES
  // ============================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.adminUpdateItem(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/:id')
  adminDelete(@Param('id') id: string) {
    return this.itemsService.adminDeleteItem(id);
  }

  // ============================
  // ADMIN FEATURED ITEM ROUTES
  // ============================

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
}
