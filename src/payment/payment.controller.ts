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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  Role,
  InterestStatus,
  FinanceStatus,
  SaleStatus,
} from '@prisma/client';

@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

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


  // ================== FINANCE TEAM ENDPOINTS (SUPER_ADMIN) ==================

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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finance approves a payment
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

    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        financeStatus: FinanceStatus.CONFIRMED, // ✅ uses existing enum
        status: SaleStatus.CONFIRMED, // ✅ sale is now confirmed
        // reuse existing "notes" field to store finance comment
        notes: body.financeNote ?? sale.notes ?? null,
      },
    });

    // Audit log with finance user
    await this.prisma.auditLog.create({
      data: {
        userId: financeUser.id,
        action: 'FINANCE_APPROVED_PAYMENT',
        entityType: 'SALE',
        entityId: saleId,
        metadata: {
          amount: sale.amount,
        },
      },
    });

    return updated;
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
        // your SaleStatus enum has CANCELLED, not REJECTED
        status: SaleStatus.CANCELLED,
        // store reason inside notes
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
        // ❌ no companyPaidAt field in schema, so we don't set it
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
