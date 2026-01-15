// src/items/items.controller.ts
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
import { Role, ItemStatus } from '@prisma/client';

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
  // ADMIN ROUTES
  // ============================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/all')
  getAllItemsWithAdmin(@Req() req) {
    const user = req.user as { id: string; role: Role };
    return this.itemsService.getAllItemsWithAdmin(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/status/:status')
  getItemsByStatus(@Req() req, @Param('status') status: ItemStatus) {
    const user = req.user as { id: string; role: Role };
    return this.itemsService.getItemsByStatus(user.id, user.role, status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/unfeatured')
  getUnfeaturedItems(@Req() req) {
    const user = req.user as { id: string; role: Role };
    return this.itemsService.getUnfeaturedItems(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/deleted')
  getDeletedItems(@Req() req) {
    const user = req.user as { id: string; role: Role };
    return this.itemsService.getDeletedItems(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('admin/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateItemDto, @Req() req) {
    const user = req.user as { id: string; role: Role };

    return this.itemsService.adminUpdateItem(id, dto, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('admin/:id')
  adminDelete(
    @Param('id') id: string,
    @Req() req,
    @Body('reason') reason?: string,
  ) {
    const user = req.user as { id: string; role: Role };

    return this.itemsService.adminDeleteItem(id, user.id, user.role, reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch('admin/:id/restore')
  restoreItem(@Param('id') id: string) {
    return this.itemsService.restoreItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Delete('admin/:id/permanent')
  permanentDeleteItem(@Param('id') id: string) {
    return this.itemsService.permanentDeleteItem(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('admin/:id/feature')
  adminFeature(@Param('id') id: string, @Req() req) {
    const user = req.user as { id: string; role: Role };

    return this.itemsService.adminFeatureItem(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('admin/:id/unfeature')
  adminUnfeature(@Param('id') id: string, @Req() req) {
    const user = req.user as { id: string; role: Role };

    return this.itemsService.adminUnfeatureItem(id, user.id, user.role);
  }

  // ============================
  // PUBLIC SEARCH / SINGLE ITEM
  // ============================

  @Get('search')
  searchItems(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('type') itemType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('location') location?: string,
  ) {
    return this.itemsService.searchItems(
      query,
      category,
      itemType,
      minPrice ? parseFloat(minPrice) : undefined,
      maxPrice ? parseFloat(maxPrice) : undefined,
      location,
    );
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.itemsService.getItemById(id);
  }

  // ============================
  // USER ROUTES
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10))
  async create(
    @Body() dto: CreateItemDto,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // ... your existing create logic
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
