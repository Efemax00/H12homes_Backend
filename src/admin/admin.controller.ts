// src/admin/admin.controller.ts
import { Controller, Get, Patch, Param, Body, Post, Delete, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Get all users (ADMIN and SUPER_ADMIN can access)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('users')
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  // Update user role (SUPER_ADMIN only)
  @Roles(Role.SUPER_ADMIN)
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: Role
  ) {
    return this.adminService.updateUserRole(userId, role);
  }

  // Feature item (ADMIN and SUPER_ADMIN can access)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('items/:id/feature')
  featureItem(@Param('id') id: string) {
    return this.adminService.featureItem(id);
  }

  // Unfeature item (ADMIN and SUPER_ADMIN can access)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('items/:id/unfeature')
  unfeatureItem(@Param('id') id: string) {
    return this.adminService.unfeatureItem(id);
  }
}