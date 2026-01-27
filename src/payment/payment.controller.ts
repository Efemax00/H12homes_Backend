// src/payment/payment.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  Body,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationFeePaymentService } from './reservation-fee-payment.service';
import { InitializeViewingFeeDto } from './dto/initialize-reservation-fee.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  Role,
  InterestStatus,
  FinanceStatus,
  SaleStatus,
  ItemStatus,
  ItemCategory,
  PaymentStatus,
} from '@prisma/client';

@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private reservationFeePaymentService: ReservationFeePaymentService,
  ) {}

  // ======================================================
  // RESERVATION FEE PAYMENT ENDPOINTS (NEW)
  // ======================================================

  /**
   * Initialize viewing fee payment via Paystack
   * POST /payment/viewing-fee/initialize
   */
  @Post('reservation-fee/initialize')
async initializeReservationFee(
  @Req() req,
  @Body() dto: InitializeViewingFeeDto, // Reuse same DTO (propertyId)
) {
  const userId = req.user.id;
  return this.reservationFeePaymentService.initializeReservationFee(
    userId,
    dto.propertyId,
  );
}

  /**
   * Verify reservation fee payment after Paystack callback
   * GET /payment/reservation-fee/verify?reference=VF-xxx
   */
  @Get('reservation-fee/verify')
async verifyReservationFee(@Query('reference') reference: string) {
  if (!reference) {
    throw new BadRequestException('Payment reference is required');
  }
  return this.reservationFeePaymentService.verifyReservationFee(reference);
}


  /**
   * Check if user has already paid reservation fee for a property
   * GET /payment/reservation-fee/check?propertyId=xxx
   */
  @Get('reservation-fee/check')
async checkReservation(
  @Req() req,
  @Query('propertyId') propertyId: string,
) {
  if (!propertyId) {
    throw new BadRequestException('Property ID is required');
  }

  const userId = req.user.id;
  const hasActiveReservation = await this.reservationFeePaymentService.hasUserActiveReservation(
    userId,
    propertyId,
  );

  return { hasActiveReservation };
}

// OLD: @Get('reservation-fee/my-payments')
// NEW:
@Get('reservation-fee/my-payments')
async getMyReservationPayments(@Req() req) {
  const userId = req.user.id;
  return this.prisma.reservationFeePayment.findMany({
    where: { userId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          location: true,
          price: true,
          images: { take: 1, select: { url: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// OLD: @Get('viewing-fee/admin')
// NEW:
@Get('reservation-fee/admin')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
async getAdminReservationPayments(@Req() req) {
  const user = req.user as { id: string; role: Role };

  const payments = await this.prisma.reservationFeePayment.findMany({
    where:
      user.role === Role.SUPER_ADMIN
        ? {}
        : {
            property: {
              createdBy: user.id,
            },
          },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      property: {
        select: {
          id: true,
          title: true,
          location: true,
          price: true,
          images: { take: 1, select: { url: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    payments,
    stats: {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      successCount: payments.filter((p) => p.status === 'SUCCESS').length,
      h12Earnings: payments
        .filter((p) => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + p.h12KeepsAmount, 0),
    },
  };
}

  // ======================================================
  // USER-SIDE: VIEW COMPANY PAYMENT DETAILS
  // ======================================================

  /**
   * Get company payment details for a specific property.
   * Only normal users who have expressed interest can see this.
   *
   * GET /payment/details/:propertyId
   */
  @Get('details/:propertyId')
  async getPaymentDetails(@Req() req, @Param('propertyId') propertyId: string) {
    const user = req.user as { id: string; role: Role };

    // 🚫 Admins / super admins should not see payment details as "buyers"
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Payment details are only available to buyers.',
      );
    }

    // 1. Ensure property exists
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // 2. Ensure this user has expressed interest in this property
    const interest = await this.prisma.propertyInterest.findFirst({
      where: {
        propertyId,
        userId: user.id,
        status: {
          in: [InterestStatus.ACTIVE, InterestStatus.PURCHASED],
        },
      },
    });

    if (!interest) {
      throw new ForbiddenException(
        'You must express interest in this property before viewing payment details.',
      );
    }

    // 3. Load payment details from environment
    const {
      COMPANY_BANK_NAME,
      COMPANY_ACCOUNT_NAME,
      COMPANY_ACCOUNT_NUMBER,
      COMPANY_PAYMENT_INSTRUCTIONS,
    } = process.env;

    if (
      !COMPANY_BANK_NAME ||
      !COMPANY_ACCOUNT_NAME ||
      !COMPANY_ACCOUNT_NUMBER
    ) {
      throw new InternalServerErrorException(
        'Company payment details are not configured. Please contact support.',
      );
    }

    return {
      bankName: COMPANY_BANK_NAME,
      accountName: COMPANY_ACCOUNT_NAME,
      accountNumber: COMPANY_ACCOUNT_NUMBER,
      instructions: COMPANY_PAYMENT_INSTRUCTIONS ?? '',
    };
  }

  // ======================================================
  // ADMIN/SUPER_ADMIN: UPLOAD PAYMENT PROOF
  // ======================================================

  @Post('upload-proof')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPaymentProof(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user as { id: string; role: Role };

    // Optional: restrict to admins / super admins
    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can upload payment proof');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const url = await this.cloudinaryService.uploadImage(file);
    return { url };
  }

  // ======================================================
  // ADMIN/SUPER_ADMIN: VIEW PAYMENTS (MAIN PROPERTY PAYMENTS)
  // ======================================================

  /**
   * Get payments for admin/superadmin:
   * - ADMIN: payments related to properties they created
   * - SUPER_ADMIN: all payments
   *
   * GET /payment/admin
   */
  @Get('admin')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAdminPayments(@Req() req) {
    const user = req.user as { id: string; role: Role };

    if (user.role === Role.SUPER_ADMIN) {
      // SUPER_ADMIN sees everything
      return this.prisma.payment.findMany({
        include: {
          property: {
            select: {
              id: true,
              title: true,
              location: true,
              category: true,
              status: true,
              images: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          sale: {
            select: {
              id: true,
              amount: true,
              status: true,
              isRental: true,
              rentalMonths: true,
              rentalStartDate: true,
              rentalEndDate: true,
              financeStatus: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // ADMIN: only payments related to properties they created
    return this.prisma.payment.findMany({
      where: {
        property: {
          createdBy: user.id,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            category: true,
            status: true,
            images: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        sale: {
          select: {
            id: true,
            amount: true,
            status: true,
            isRental: true,
            rentalMonths: true,
            rentalStartDate: true,
            rentalEndDate: true,
            financeStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ======================================================
  // FINANCE TEAM ENDPOINTS (SUPER_ADMIN)
  // ======================================================

  /**
   * Get all pending payments for finance review
   * GET /payment/pending
   * SUPER_ADMIN only
   */
  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  async getPendingPayments() {
    return this.prisma.sale.findMany({
      where: {
        status: SaleStatus.PAYMENT_SUBMITTED,
        financeStatus: FinanceStatus.PENDING,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            images: true,
            category: true,
            status: true,
            rentDurationMonths: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finance approves a payment:
   * - marks all payments for this sale as SUCCESS
   * - confirms the sale
   * - updates the property:
   *    - FOR_RENT / SHORT_STAY -> RENTED + rentStartDate/rentEndDate
   *    - FOR_SALE -> SOLD
   *
   * PATCH /payment/:saleId/finance-approve
   * SUPER_ADMIN only
   */
  @Patch(':saleId/finance-approve')
  @Roles(Role.SUPER_ADMIN)
  async approvePayment(
    @Req() req,
    @Param('saleId') saleId: string,
    @Body() body: { financeNote?: string },
  ) {
    const financeUser = req.user as { id: string; role: Role };

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        property: true, // Item
        payments: true, // Payment[]
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');

    const property = sale.property;
    if (!property) {
      throw new NotFoundException('Linked property not found');
    }

    // Determine if this is a rental deal based on category or existing flag
    const isRentalCategory =
      property.category === ItemCategory.FOR_RENT ||
      property.category === ItemCategory.SHORT_STAY;

    const isRental = isRentalCategory || sale.isRental;

    // -------- Rental date variables (keep Sale vs Item separate) --------

    // For Sale table (rentalStartDate, rentalEndDate, rentalMonths)
    let saleRentalStart: Date | null = null;
    let saleRentalEnd: Date | null = null;
    let saleRentalMonths: number | null = null;

    // For Item table (rentStartDate, rentEndDate, rentDurationMonths)
    let itemRentStart: Date | null = null;
    let itemRentEnd: Date | null = null;
    let itemRentDuration: number | null = null;

    if (isRental) {
      const now = new Date();

      // Priority: sale.rentalMonths > property.rentDurationMonths > default 12
      const months = sale.rentalMonths ?? property.rentDurationMonths ?? 12;

      // Assign for Sale
      saleRentalStart = now;
      saleRentalEnd = new Date(now);
      saleRentalEnd.setMonth(saleRentalEnd.getMonth() + months);
      saleRentalMonths = months;

      // Assign for Item
      itemRentStart = now;
      itemRentEnd = saleRentalEnd;
      itemRentDuration = months;
    }

    // 1) Mark all payments for this sale as SUCCESS
    await this.prisma.payment.updateMany({
      where: { saleId },
      data: {
        status: PaymentStatus.SUCCESS,
      },
    });

    // 2) Update Sale (rental* fields go here)
    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        financeStatus: FinanceStatus.CONFIRMED,
        status: SaleStatus.CONFIRMED,
        isRental,
        rentalMonths: saleRentalMonths,
        rentalStartDate: saleRentalStart,
        rentalEndDate: saleRentalEnd,
        financeReviewedById: financeUser.id,
        financeReviewedAt: new Date(),
        notes: body.financeNote ?? sale.notes ?? null,
      },
    });

    // 3) Update property (Item) status + rent countdown fields
    const newItemStatus: ItemStatus = isRental
      ? ItemStatus.RENTED
      : ItemStatus.SOLD;

    const updatedItem = await this.prisma.item.update({
      where: { id: property.id },
      data: {
        status: newItemStatus,
        rentStartDate: itemRentStart,
        rentEndDate: itemRentEnd,
        rentDurationMonths: itemRentDuration,
        autoReopenAt: isRental ? itemRentEnd : null,
      },
    });

    // 4) Audit log with finance user
    await this.prisma.auditLog.create({
      data: {
        userId: financeUser.id,
        action: 'FINANCE_APPROVED_PAYMENT',
        entityType: 'SALE',
        entityId: saleId,
        metadata: {
          amount: sale.amount,
          isRental,
          rentalMonths: itemRentDuration,
        },
      },
    });

    // Return sale + updated property snapshot
    return {
      sale: updatedSale,
      property: updatedItem,
    };
  }

  /**
   * Finance rejects a payment
   * PATCH /payment/:saleId/finance-reject
   * SUPER_ADMIN only
   */
  @Patch(':saleId/finance-reject')
  @Roles(Role.SUPER_ADMIN)
  async rejectPayment(
    @Req() req,
    @Param('saleId') saleId: string,
    @Body() body: { reason: string },
  ) {
    const financeUser = req.user as { id: string; role: Role };

    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        financeStatus: FinanceStatus.REJECTED,
        status: SaleStatus.CANCELLED,
        notes: body.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: financeUser.id,
        action: 'FINANCE_REJECTED_PAYMENT',
        entityType: 'SALE',
        entityId: saleId,
        metadata: {
          amount: sale.amount,
          reason: body.reason,
        },
      },
    });

    return updated;
  }

  /**
   * Mark that money has actually hit the H12 company account
   * PATCH /payment/:saleId/mark-company-paid
   * SUPER_ADMIN only
   */
  @Patch(':saleId/mark-company-paid')
  @Roles(Role.SUPER_ADMIN)
  async markCompanyPaid(
    @Req() req,
    @Param('saleId') saleId: string,
    @Body() body: { paidAt?: string },
  ) {
    const financeUser = req.user as { id: string; role: Role };

    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    const paidAtDate = body.paidAt ? new Date(body.paidAt) : new Date();

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        companyAccountPaid: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: financeUser.id,
        action: 'COMPANY_ACCOUNT_MARKED_PAID',
        entityType: 'SALE',
        entityId: saleId,
        metadata: {
          amount: sale.amount,
          paidAt: paidAtDate,
        },
      },
    });

    return updated;
  }
}