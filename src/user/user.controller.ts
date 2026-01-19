// src/user/user.controller.ts
import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
    private cloudinaryService: CloudinaryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const userData = await this.userService.findById(user.id);
    if (!userData) return null;

    const { password, ...safeUser } = userData;
    return safeUser;
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const userId = user.id;

    const currentUser = await this.userService.findById(userId);
    
    if (currentUser?.avatarUrl) {
      await this.cloudinaryService.deleteImage(currentUser.avatarUrl);
    }

    const avatarUrl = await this.cloudinaryService.uploadImage(file);
    const updatedUser = await this.userService.updateAvatar(userId, avatarUrl);

    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }
}