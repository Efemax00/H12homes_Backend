// src/landlords/landlords.service.ts
import { Injectable, NotFoundException, } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Landlord, LandlordVerificationStatus, Prisma, } from '@prisma/client';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { ReviewLandlordDto } from './dto/review-landlord.dto';

interface FindAllLandlordsParams {
  status?: LandlordVerificationStatus;
  search?: string;
}

@Injectable()
export class LandlordsService {
  constructor(private readonly prisma: PrismaService) {}

  // 👑 SUPER_ADMIN: list landlords (with optional filters)
  async findAll(params: FindAllLandlordsParams): Promise<Landlord[]> {
    const { status, search } = params;

    const where: Prisma.LandlordWhereInput = {};

    if (status) {
      where.verificationStatus = status;
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      where.OR = [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
        { bankName: { contains: searchTerm, mode: 'insensitive' } },
        { accountNumber: { contains: searchTerm, mode: 'insensitive' } },
        { accountName: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.landlord.findMany({
      where,
      include: {
        properties: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                location: true,
                status: true,
                price: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 👑 SUPER_ADMIN: single landlord + linked properties
  async findOne(id: string) {
    const landlord = await this.prisma.landlord.findUnique({
      where: { id },
      include: {
        properties: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                location: true,
                status: true,
                price: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    return landlord;
  }

  // 👑 SUPER_ADMIN: update basic landlord info
  async update(id: string, dto: UpdateLandlordDto) {
    const landlord = await this.prisma.landlord.findUnique({ where: { id } });

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    return this.prisma.landlord.update({
      where: { id },
      data: {
        fullName: dto.fullName ?? landlord.fullName,
        phone: dto.phone ?? landlord.phone,
        email: dto.email ?? landlord.email,
        address: dto.address ?? landlord.address,
        bankName: dto.bankName ?? landlord.bankName,
        accountNumber: dto.accountNumber ?? landlord.accountNumber,
        accountName: dto.accountName ?? landlord.accountName,
      },
    });
  }

  // 👑 SUPER_ADMIN: verify / reject landlord
  async review(id: string, dto: ReviewLandlordDto) {
    const landlord = await this.prisma.landlord.findUnique({ where: { id } });

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    return this.prisma.landlord.update({
      where: { id },
      data: {
        verificationStatus: dto.status,
        // if later you add a "verificationComment" column, set it here
      },
    });
  }
}
