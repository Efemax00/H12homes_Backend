// src/payment/payment.controller.ts
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, InterestStatus } from '@prisma/client';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private prisma: PrismaService) {}

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
      throw new ForbiddenException('Payment details are only available to buyers.');
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

    if (!COMPANY_BANK_NAME || !COMPANY_ACCOUNT_NAME || !COMPANY_ACCOUNT_NUMBER) {
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
}
