import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ItemStatus, Role, ItemCategory, ItemType, Prisma, Landlord, PaymentStatus } from '@prisma/client';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { COMMISSION_CONFIG } from '../config/commission.config';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  // ======================
  // PUBLIC ROUTES
  // ======================

  // Homepage / Listing (featured first) - EXCLUDE DELETED
  // ⬇️ Now shows AVAILABLE + RENTED so rented properties don't vanish
  async getPublicItems() {
    return this.prisma.item.findMany({
      where: {
        isDeleted: false,
        status: {
          in: [ItemStatus.AVAILABLE, ItemStatus.RENTED],
        },
      },
      include: {
        images: true,
        createdByUser: {
          select: {
            phone: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // Item details page (even SOLD/RENTED) - EXCLUDE DELETED
  async getItemById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        images: true,
        createdByUser: {
          select: {
            phone: true,
          },
        },
      },
    });

    if (!item || item.isDeleted) return null;
    return item;
  }

  // ======================
  // ADMIN LISTING QUERIES
  // ======================

  // ✅ Only my items if ADMIN, all if SUPER_ADMIN
  // src/items/items.service.ts - Update this method

async getAllItemsWithAdmin(adminId: string, role: Role) {
  const where: Prisma.ItemWhereInput =
    role === Role.SUPER_ADMIN
      ? { isDeleted: false }
      : {
          isDeleted: false,
          createdBy: adminId,
        };

  return this.prisma.item.findMany({
    where,
    include: {
      images: true,
      landlordLinks: {
        include: {
          landlord: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  });
}


  // ✅ Get items by status, but scoped by admin
  async getItemsByStatus(adminId: string, role: Role, status: ItemStatus) {
    const base: Prisma.ItemWhereInput = {  // ✅ Type-safe!
      status,
      isDeleted: false,
    };

    const where: Prisma.ItemWhereInput =
      role === Role.SUPER_ADMIN
        ? base
        : {
            ...base,
            createdBy: adminId,
          };

    return this.prisma.item.findMany({
      where,
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
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ✅ Get unfeatured items (scoped)
  async getUnfeaturedItems(adminId: string, role: Role) {
    const base: Prisma.ItemWhereInput = {  // ✅ Type-safe!
      isFeatured: false,
      isDeleted: false,
    };

    const where: Prisma.ItemWhereInput =
      role === Role.SUPER_ADMIN
        ? base
        : {
            ...base,
            createdBy: adminId,
          };

    return this.prisma.item.findMany({
      where,
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
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ✅ Deleted items (only SUPER_ADMIN hits this route anyway)
  async getDeletedItems(adminId: string, role: Role) {
    return this.prisma.item.findMany({
      where: {
        isDeleted: true,
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
      orderBy: [{ deletedAt: 'desc' }],
    });
  }

  // ======================
  // USER ROUTES (AUTH REQUIRED)
  // ======================

  // Create a new item
async createItem(
  dto: CreateItemDto,
  userId: string,
  files: Express.Multer.File[],
) {
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

  // 🔢 ---- NUMERIC CONVERSIONS ----

  // price (required)
  const price =
    dto.price !== undefined && dto.price !== null ? Number(dto.price) : 0;

  if (Number.isNaN(price)) {
    throw new BadRequestException('Invalid price value');
  }

  // bedrooms (optional)
  const bedrooms =
    dto.bedrooms !== undefined && dto.bedrooms !== null
      ? Number(dto.bedrooms)
      : null;

  if (bedrooms !== null && Number.isNaN(bedrooms)) {
    throw new BadRequestException('Invalid bedrooms value');
  }

  // bathrooms (optional)
  const bathrooms =
    dto.bathrooms !== undefined && dto.bathrooms !== null
      ? Number(dto.bathrooms)
      : null;

  if (bathrooms !== null && Number.isNaN(bathrooms)) {
    throw new BadRequestException('Invalid bathrooms value');
  }

  // sqft (optional)
  const sqft =
    dto.sqft !== undefined && dto.sqft !== null ? Number(dto.sqft) : null;

  if (sqft !== null && Number.isNaN(sqft)) {
    throw new BadRequestException('Invalid sqft value');
  }

  // rentDurationMonths (optional)
  const rentDurationMonths =
    dto.rentDurationMonths !== undefined && dto.rentDurationMonths !== null
      ? Number(dto.rentDurationMonths)
      : null;

  if (rentDurationMonths !== null && Number.isNaN(rentDurationMonths)) {
    throw new BadRequestException('Invalid rentDurationMonths value');
  }

  // 💰 ---- COMMISSION CONFIG (platform-fixed) ----
  const agentCommissionPercent = COMMISSION_CONFIG.AGENT_SHARE_PERCENT;
  const companyCommissionPercent = COMMISSION_CONFIG.COMPANY_SHARE_PERCENT;
  const platformFeePercent = COMMISSION_CONFIG.PLATFORM_FEE_PERCENT;

  // 🧑‍💼 ---- LANDLORD (from DTO) ----
  const {
    landlordFullName,
    landlordPhone,
    landlordEmail,
    landlordAddress,
    landlordBankName,
    landlordAccountNumber,
    landlordAccountName,
  } = dto;

  const hasLandlordDetails =
    (landlordFullName && landlordFullName.trim().length > 0) ||
    landlordPhone ||
    landlordEmail ||
    landlordBankName ||
    landlordAccountNumber ||
    landlordAccountName;

  let landlordRecord: Landlord | null = null;

  if (hasLandlordDetails) {
    // Try to reuse an existing landlord so we don't duplicate rows
    landlordRecord = await this.prisma.landlord.findFirst({
      where: {
        ...(landlordFullName
          ? { fullName: landlordFullName.trim() }
          : {}),
        ...(landlordPhone
          ? { phone: landlordPhone.trim() }
          : {}),
        ...(landlordEmail
          ? { email: landlordEmail.trim().toLowerCase() }
          : {}),
        ...(landlordAccountNumber
          ? { accountNumber: landlordAccountNumber.trim() }
          : {}),
      },
    });

    if (!landlordRecord) {
      landlordRecord = await this.prisma.landlord.create({
        data: {
          fullName:
            landlordFullName && landlordFullName.trim().length > 0
              ? landlordFullName.trim()
              : 'Unknown landlord',
          phone: landlordPhone?.trim() ?? null,
          email: landlordEmail ? landlordEmail.trim().toLowerCase() : null,
          address: landlordAddress?.trim() ?? null,
          bankName: landlordBankName?.trim() ?? null,
          accountNumber: landlordAccountNumber?.trim() ?? null,
          accountName: landlordAccountName?.trim() ?? null,
          // verificationStatus defaults to PENDING
        },
      });
    }
  }

  // 🔥 ---- CREATE ITEM (with optional landlord link) ----
  const item = await this.prisma.item.create({
    data: {
      // Core fields
      title: dto.title,
      shortDesc: dto.shortDesc,
      longDesc: dto.longDesc,
      dos: dto.dos,
      donts: dto.donts,
      price,
      location: dto.location,
      contactInfo: dto.contactInfo ?? null,

      // Enums
      category: dto.category,
      itemType: dto.itemType,

      // Status / featured
      status: ItemStatus.PENDING,
      isFeatured: false,

      // Property details
      bedrooms,
      bathrooms,
      sqft,
      propertyType: dto.propertyType ?? null,

      // Rent configuration
      rentDurationMonths,
      rentStartDate: null,
      rentEndDate: null,
      autoReopenAt: null,

      // Commissions (platform-fixed)
      agentCommissionPercent,
      companyCommissionPercent,
      platformFeePercent,

      // Ownership / Agent
      ownerId: null,
      agentId: userId,
      createdBy: userId,

      // 🔗 Landlord link (only if we resolved one)
      ...(landlordRecord
        ? {
            landlordLinks: {
              create: {
                landlordId: landlordRecord.id,
              },
            },
          }
        : {}),

      // Images
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

  if (landlordRecord) {
    console.log(
      `🏠 Linked property ${item.id} to landlord ${landlordRecord.id} (${landlordRecord.fullName})`,
    );
  }

  return item;
}


  async updateOwnItem(itemId: string, dto: UpdateItemDto, userId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });

    if (!item || item.ownerId !== userId) {
      throw new ForbiddenException('You do not own this item');
    }

    if (item.isDeleted) {
      throw new ForbiddenException('Cannot update deleted item');
    }

    // ✅ Type-safe way to remove isFeatured
    const { isFeatured, ...safeDto } = dto;

    // If you also want to prevent normal users from editing commissions:
    // const { isFeatured, agentCommissionPercent, companyCommissionPercent, ownerCommissionPercent, ...safeDto } = dto;

    return this.prisma.item.update({
      where: { id: itemId },
      data: safeDto,
    });
  }

  async searchItems(
    searchQuery?: string,
    category?: string,
    itemType?: string,
    minPrice?: number,
    maxPrice?: number,
    location?: string,
  ) {
    const where: Prisma.ItemWhereInput = {  // ✅ Type-safe!
      isDeleted: false,
      status: {
        in: [ItemStatus.AVAILABLE, ItemStatus.RENTED],
      },
    };

    // Text search
    if (searchQuery && searchQuery.trim()) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { shortDesc: { contains: searchQuery, mode: 'insensitive' } },
        { location: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Location filter
    if (location && location.trim()) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    // Category filter (ItemCategory enum string)
    if (category) {
      where.category = category as ItemCategory;
    }

    // Item type filter (ItemType enum string)
    if (itemType) {
      where.itemType = itemType as ItemType;
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    return this.prisma.item.findMany({
      where,
      include: { images: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ======================
  // ADMIN ACTIONS
  // ======================

  // Admin update (respect ownership unless SUPER_ADMIN)
  // src/items/items.service.ts

// Add this method after adminUpdateItem
async adminUpdateItem(
  id: string,
  dto: UpdateItemDto,
  adminId: string,
  role: Role,
) {
  const item = await this.prisma.item.findUnique({
    where: { id },
    include: {
      landlordLinks: {
        include: {
          landlord: true,
        },
      },
    },
  });

  if (!item) throw new NotFoundException('Item not found');

  if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
    throw new ForbiddenException('You cannot manage another admin\'s listing');
  }

  // ✅ Extract landlord fields from DTO
  const {
    landlordFullName,
    landlordPhone,
    landlordEmail,
    landlordAddress,
    landlordBankName,
    landlordAccountNumber,
    landlordAccountName,
    ...itemUpdateData
  } = dto;

  // ✅ Check if any landlord data was provided
  const hasLandlordUpdate =
    landlordFullName !== undefined ||
    landlordPhone !== undefined ||
    landlordEmail !== undefined ||
    landlordAddress !== undefined ||
    landlordBankName !== undefined ||
    landlordAccountNumber !== undefined ||
    landlordAccountName !== undefined;

  // ✅ Handle landlord updates if provided
  if (hasLandlordUpdate) {
    const existingLink = item.landlordLinks[0];
    
    if (existingLink) {
      // Update existing landlord
      await this.prisma.landlord.update({
        where: { id: existingLink.landlordId },
        data: {
          ...(landlordFullName !== undefined && { fullName: landlordFullName.trim() }),
          ...(landlordPhone !== undefined && { phone: landlordPhone?.trim() ?? null }),
          ...(landlordEmail !== undefined && { email: landlordEmail ? landlordEmail.trim().toLowerCase() : null }),
          ...(landlordAddress !== undefined && { address: landlordAddress?.trim() ?? null }),
          ...(landlordBankName !== undefined && { bankName: landlordBankName?.trim() ?? null }),
          ...(landlordAccountNumber !== undefined && { accountNumber: landlordAccountNumber?.trim() ?? null }),
          ...(landlordAccountName !== undefined && { accountName: landlordAccountName?.trim() ?? null }),
        },
      });
    } else if (landlordFullName && landlordFullName.trim()) {
      // Create new landlord and link
      const newLandlord = await this.prisma.landlord.create({
        data: {
          fullName: landlordFullName.trim(),
          phone: landlordPhone?.trim() ?? null,
          email: landlordEmail ? landlordEmail.trim().toLowerCase() : null,
          address: landlordAddress?.trim() ?? null,
          bankName: landlordBankName?.trim() ?? null,
          accountNumber: landlordAccountNumber?.trim() ?? null,
          accountName: landlordAccountName?.trim() ?? null,
        },
      });

      await this.prisma.propertyToLandlord.create({
        data: {
          propertyId: item.id,
          landlordId: newLandlord.id,
        },
      });
    }
  }

  // ✅ Update the item itself (excluding landlord fields)
  return this.prisma.item.update({
    where: { id },
    data: itemUpdateData,
    include: {
      images: true,
      landlordLinks: {
        include: {
          landlord: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
      },
    },
  });
}

  // Soft delete
  async adminDeleteItem(
    id: string,
    adminId: string,
    role: Role,
    reason?: string,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.isDeleted) {
      throw new ForbiddenException('Item is already deleted');
    }

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException('You cannot delete another admin\'s listing');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminId,
        deletionReason: reason || 'Deleted by admin',
      },
    });
  }

  // Restore deleted item (SUPER_ADMIN route only, but we still guard by state)
  async restoreItem(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.isDeleted) {
      throw new ForbiddenException('Item is not deleted');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      },
    });
  }

  // Permanent delete (SUPER_ADMIN only)
  async permanentDeleteItem(id: string) {
    return this.prisma.item.delete({ where: { id } });
  }

  // Feature / unfeature with ownership check
  async adminFeatureItem(id: string, adminId: string, role: Role) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException(
        'You cannot feature another admin\'s listing',
      );
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        isFeatured: true,
        status: ItemStatus.AVAILABLE,
      },
    });
  }

  async adminUnfeatureItem(id: string, adminId: string, role: Role) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
      throw new ForbiddenException(
        'You cannot unfeature another admin\'s listing',
      );
    }

    return this.prisma.item.update({
      where: { id },
      data: { isFeatured: false },
    });
  }

  // src/items/items.service.ts

async getItemForEdit(id: string, adminId: string, role: Role) {
  const item = await this.prisma.item.findUnique({
    where: { id },
    include: {
      images: true,
      landlordLinks: {
        include: {
          landlord: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!item) throw new NotFoundException('Item not found');

  if (role !== Role.SUPER_ADMIN && item.createdBy !== adminId) {
    throw new ForbiddenException('You cannot view another admin\'s listing details');
  }

  return item;
}

// ============================
// RESERVATION FEE SYSTEM
// ============================

async reserveProperty(propertyId: string, userId: string) {
  const item = await this.prisma.item.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      status: true,
      isReserved: true,
      currentReservationBy: true,
      reservationExpiresAt: true,
    },
  });

  if (!item) throw new NotFoundException('Property not found');

  // ✅ if reservation expired, release it first
  const isExpired =
    item.isReserved &&
    item.reservationExpiresAt &&
    new Date() > item.reservationExpiresAt;

  if (isExpired) {
    await this.prisma.item.update({
      where: { id: propertyId },
      data: {
        isReserved: false,
        currentReservationBy: null,
        reservationStartedAt: null,
        reservationExpiresAt: null,
        status: ItemStatus.AVAILABLE,
      },
    });
  }

  // ✅ if still reserved by another person, block
  const stillReservedByAnother =
    item.isReserved &&
    item.currentReservationBy &&
    item.currentReservationBy !== userId &&
    !isExpired;

  if (stillReservedByAnother) {
    throw new BadRequestException('Property is already reserved by another user');
  }

  // ✅ optional: if YOU want only AVAILABLE properties to be reservable,
  // allow reserving user to proceed even if status is PENDING (because you set it)
  if (item.status !== ItemStatus.AVAILABLE && item.currentReservationBy !== userId) {
    throw new BadRequestException('Property is not available for reservation');
  }

  // ✅ create pending payment record (or do this after paystack initialize)
  const paystackReference = `RSV-${Date.now()}-${userId.slice(0, 8)}`;

  const payment = await this.prisma.reservationFeePayment.create({
    data: {
      userId,
      propertyId,
      amount: 10000,
      paystackReference,
      status: PaymentStatus.PENDING,
      h12KeepsAmount: 10000,
    },
  });

  return {
    message: 'Reservation fee created. Proceed to payment.',
    reference: paystackReference,
    paymentId: payment.id,
  };
}


async getReservationStatus(propertyId: string, userId: string) {
  const item = await this.prisma.item.findUnique({
    where: { id: propertyId },
    select: {
      isReserved: true,
      currentReservationBy: true,
      reservationExpiresAt: true,
    },
  });

  if (!item) throw new NotFoundException('Property not found');

  const payment = await this.prisma.reservationFeePayment.findFirst({
    where: { propertyId, userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    return { hasReservation: false, message: 'No reservation record' };
  }

  const now = new Date();
  const expiresAt = item.reservationExpiresAt;

  const isActive =
    payment.status === PaymentStatus.SUCCESS &&
    item.isReserved &&
    item.currentReservationBy === userId &&
    !!expiresAt &&
    now < expiresAt;

  const daysRemaining =
    expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return {
    hasReservation: isActive,
    reserved: item.isReserved,
    reservedByMe: item.currentReservationBy === userId,
    paymentStatus: payment.status,
    amount: payment.amount,
    paidAt: payment.paidAt,
    expiresAt,
    daysRemaining,
  };
}


async cancelReservation(propertyId: string, userId: string, reason?: string) {
  const item = await this.prisma.item.findUnique({
    where: { id: propertyId },
    select: {
      isReserved: true,
      currentReservationBy: true,
      reservationExpiresAt: true,
    },
  });

  if (!item) throw new NotFoundException('Property not found');

  if (!item.isReserved || item.currentReservationBy !== userId) {
    throw new BadRequestException('You do not own an active reservation for this property');
  }

  // If expired, treat it as already over
  if (!item.reservationExpiresAt || new Date() > item.reservationExpiresAt) {
    throw new BadRequestException('Reservation has expired');
  }

  const payment = await this.prisma.reservationFeePayment.findFirst({
    where: { propertyId, userId, status: PaymentStatus.SUCCESS },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    throw new NotFoundException('No paid reservation found');
  }

  await this.prisma.item.update({
    where: { id: propertyId },
    data: {
      isReserved: false,
      currentReservationBy: null,
      reservationStartedAt: null,
      reservationExpiresAt: null,
      status: ItemStatus.AVAILABLE,
    },
  });

  return {
    message: 'Reservation cancelled',
    amount: payment.amount,
    note: 'Reservation fee (₦10,000) is non-refundable',
    reason: reason ?? 'User cancelled',
  };
}


// Handle Paystack webhook for reservation fee
async handleReservationFeePayment(paystackRef: string, status: string) {
  const payment = await this.prisma.reservationFeePayment.findUnique({
    where: { paystackReference: paystackRef },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  if (status !== 'success') {
    await this.prisma.reservationFeePayment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    return { success: false };
  }

  // Mark payment as successful
  await this.prisma.reservationFeePayment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      paidAt: new Date(),
    },
  });

  // Lock the property
  await this.prisma.item.update({
    where: { id: payment.propertyId },
    data: {
      isReserved: true,
      currentReservationBy: payment.userId,
      reservationStartedAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      reservationFeeStatus: 'PAID',
      reservationFeePaidAt: new Date(),
      status: ItemStatus.PENDING,
    },
  });

  // Create VA chat for this property
  // (We'll add household items VA separately)

  return { success: true };
}

}