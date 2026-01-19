import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { LandlordsService } from './landlords.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, LandlordVerificationStatus } from '@prisma/client';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { ReviewLandlordDto } from './dto/review-landlord.dto';

@Controller('landlords')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LandlordsController {
  constructor(private readonly landlordsService: LandlordsService) {}

  // 👑 SUPER_ADMIN: list landlords with optional filters
  @Get()
  @Roles(Role.SUPER_ADMIN)
  async findAll(
    @Query('status') status?: LandlordVerificationStatus,
    @Query('search') search?: string,
  ) {
    return this.landlordsService.findAll({ status, search });
  }

  // 👑 SUPER_ADMIN: single landlord + linked properties
  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.landlordsService.findOne(id);
  }

  // 👑 SUPER_ADMIN: update basic landlord info
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLandlordDto,
  ) {
    return this.landlordsService.update(id, dto);
  }

  // 👑 SUPER_ADMIN: review/verify landlord
  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewLandlordDto,
  ) {
    return this.landlordsService.review(id, dto);
  }
}
