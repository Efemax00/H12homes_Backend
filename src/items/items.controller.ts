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
} from '@nestjs/common';
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

  // ============================
  // USER ROUTES (AUTH REQUIRED)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateItemDto, @Req() req) {
    // Users submit items, will NOT be featured
    return this.itemsService.createItem(dto, req.user.id);
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
