// src/admin/admin.controller.ts
import { Controller, Get, Patch, Param, Body, Post, Delete, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  prisma: any;
  constructor(private adminService: AdminService) {}

  // Get all users
  @Get('users')
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  // Update user role
  @Patch('users/:id/role')
  @UseGuards(SuperAdminGuard)
  async updateUserRole(userId: string, role: Role) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}


  // Featured items
  @Post('items/:id/feature')
featureItem(@Param('id') id: string) {
  return this.adminService.featureItem(id);
}

@Patch('items/:id/unfeature')
unfeatureItem(@Param('id') id: string) {
  return this.adminService.unfeatureItem(id);
}
}
