// src/payments/viewing-fee-payment.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from '../paystack/paystack.service';

@Injectable()
export class ViewingFeePaymentService {
  // Viewing fee amount (can be moved to config later)
  private readonly VIEWING_FEE_AMOUNT = 10000; // ₦10,000
  private readonly COMPANY_SHARE_PERCENT = 60; // 60%
  private readonly AGENT_SHARE_PERCENT = 40; // 40%

  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
  ) {}

  async initializeViewingFee(userId: string, propertyId: string) {
    // 1. Check if user already paid for this property
    const existingPayment = await this.prisma.viewingFeePayment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'SUCCESS',
      },
    });

    if (existingPayment) {
      throw new BadRequestException(
        'You have already paid the viewing fee for this property',
      );
    }

    // 2. Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3. Get property details
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        agentId: true,
        createdBy: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // 4. Calculate commission splits
    const amount = this.VIEWING_FEE_AMOUNT;
    const companyShare = amount * (this.COMPANY_SHARE_PERCENT / 100);
    const agentShare = amount * (this.AGENT_SHARE_PERCENT / 100);

    // 5. Generate unique reference
    const reference = `VF-${Date.now()}-${userId.substring(0, 8)}`;

    // 6. Initialize Paystack payment
    const paymentData = await this.paystack.initializePayment(
      user.email,
      amount,
      reference,
      {
        userId,
        propertyId,
        propertyTitle: property.title,
        propertyPrice: property.price,
        customerName: `${user.firstName} ${user.lastName}`,
        type: 'viewing_fee',
        agentId: property.agentId || property.createdBy,
      },
    );

    // 7. Create payment record in database
    await this.prisma.viewingFeePayment.create({
      data: {
        userId,
        propertyId,
        amount,
        paystackReference: reference,
        status: 'PENDING',
        companyShare,
        agentShare,
        metadata: {
          agentId: property.agentId || property.createdBy,
          propertyTitle: property.title,
          propertyLocation: property.location,
        },
      },
    });

    return {
      authorizationUrl: paymentData.authorization_url,
      accessCode: paymentData.access_code,
      reference: paymentData.reference,
      amount,
    };
  }

  async verifyViewingFee(reference: string) {
    // 1. Verify payment with Paystack
    const verified = await this.paystack.verifyPayment(reference);

    // 2. Find payment record in database
    const payment = await this.prisma.viewingFeePayment.findUnique({
      where: { paystackReference: reference },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            agentId: true,
            createdBy: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment record not found');
    }

    // 3. If already verified, return success
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment already verified',
        payment,
      };
    }

    // 4. Update payment status to SUCCESS
    const updatedPayment = await this.prisma.viewingFeePayment.update({
      where: { paystackReference: reference },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(verified.paidAt),
      },
    });

    // 5. Create or update PropertyInterest (unlock chat)
    await this.prisma.propertyInterest.upsert({
      where: {
        propertyId_userId: {
          propertyId: payment.propertyId,
          userId: payment.userId,
        },
      },
      create: {
        userId: payment.userId,
        propertyId: payment.propertyId,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    // 6. Track engagement analytics
    await this.prisma.propertyEngagement.create({
      data: {
        propertyId: payment.propertyId,
        userId: payment.userId,
        actionType: 'CLICKED_INTERESTED',
        metadata: {
          viewingFeePaid: true,
          amount: payment.amount,
        },
      },
    });

    return {
      success: true,
      message: 'Payment verified successfully. You can now chat with the agent.',
      payment: updatedPayment,
    };
  }

  async hasUserPaidViewingFee(
    userId: string,
    propertyId: string,
  ): Promise<boolean> {
    const payment = await this.prisma.viewingFeePayment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'SUCCESS',
      },
    });

    return !!payment;
  }

  async getUserPayments(userId: string) {
    return this.prisma.viewingFeePayment.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            images: {
              take: 1,
              select: { url: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}