// src/payments/payments.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from '../paystack/paystack.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
  ) {}

  async initializeViewingFee(userId: string, propertyId: string) {
    // Check if user already paid for this property
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

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get property
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, agentId: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const amount = 10000; // ₦10,000 viewing fee
    const reference = `VF-${Date.now()}-${userId.substring(0, 8)}`;

    // Initialize Paystack payment
    const paymentData = await this.paystack.initializePayment(
      user.email,
      amount,
      reference,
      {
        userId,
        propertyId,
        propertyTitle: property.title,
        customerName: `${user.firstName} ${user.lastName}`,
        type: 'viewing_fee',
      },
    );

    // Create payment record
    await this.prisma.viewingFeePayment.create({
      data: {
        userId,
        propertyId,
        amount,
        paystackReference: reference,
        status: 'PENDING',
        agentShare: amount * 0.4, // 40%
        companyShare: amount * 0.6, // 60%
        metadata: {
          agentId: property.agentId,
        },
      },
    });

    return {
      authorizationUrl: paymentData.authorization_url,
      accessCode: paymentData.access_code,
      reference: paymentData.reference,
    };
  }

  // OLD: async initializeViewingFee(userId: string, propertyId: string)
// NEW: async initializeReservationFee(userId: string, propertyId: string)

async initializeReservationFee(userId: string, propertyId: string) {
  // Check if property already reserved by someone else
  const property = await this.prisma.item.findUnique({
    where: { id: propertyId },
    select: { 
      id: true, 
      title: true, 
      agentId: true,
      isReserved: true,
      currentReservationBy: true,
    },
  });

  if (!property) {
    throw new NotFoundException('Property not found');
  }

  // If already reserved by ANOTHER user
  if (property.isReserved && property.currentReservationBy !== userId) {
    throw new BadRequestException(
      'Property is already reserved by another user',
    );
  }

  // If THIS user already has active reservation, allow to proceed with payment
  if (property.isReserved && property.currentReservationBy === userId) {
    throw new BadRequestException(
      'You already have an active reservation for this property',
    );
  }

  // Get user
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const amount = 10000; // ₦10,000 reservation fee
  const reference = `RSV-${Date.now()}-${userId.substring(0, 8)}`;

  // Initialize Paystack payment
  const paymentData = await this.paystack.initializePayment(
    user.email,
    amount,
    reference,
    {
      userId,
      propertyId,
      propertyTitle: property.title,
      customerName: `${user.firstName} ${user.lastName}`,
      type: 'reservation_fee', // Changed from viewing_fee
    },
  );

  // Create reservation fee payment record
  await this.prisma.reservationFeePayment.create({
    data: {
      userId,
      propertyId,
      amount,
      paystackReference: reference,
      status: 'PENDING',
      h12KeepsAmount: amount, // H12 keeps 100%
    },
  });

  return {
    authorizationUrl: paymentData.authorization_url,
    accessCode: paymentData.access_code,
    reference: paymentData.reference,
  };
}

  async verifyViewingFee(reference: string) {
    // Verify with Paystack
    const verified = await this.paystack.verifyPayment(reference);

    // Find payment record
    const payment = await this.prisma.viewingFeePayment.findUnique({
      where: { paystackReference: reference },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            agentId: true,
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

    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment already verified',
        payment,
      };
    }

    // Update payment status
    const updatedPayment = await this.prisma.viewingFeePayment.update({
      where: { paystackReference: reference },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(verified.paidAt),
      },
    });

    // Create or update property interest (unlock chat)
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
      },
    });

    return {
      success: true,
      message: 'Payment verified successfully',
      payment: updatedPayment,
    };
  }

  // OLD: async verifyViewingFee(reference: string)
// NEW: async verifyReservationFee(reference: string)

async verifyReservationFee(reference: string) {
  // Verify with Paystack
  const verified = await this.paystack.verifyPayment(reference);

  // Find payment record
  const payment = await this.prisma.reservationFeePayment.findUnique({
    where: { paystackReference: reference },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          agentId: true,
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

  if (payment.status === 'SUCCESS') {
    return {
      success: true,
      message: 'Payment already verified',
      payment,
    };
  }

  // Update payment status
  const updatedPayment = await this.prisma.reservationFeePayment.update({
    where: { paystackReference: reference },
    data: {
      status: 'SUCCESS',
      paidAt: new Date(verified.paidAt),
    },
  });

  // Lock the property (reserve it)
  await this.prisma.item.update({
    where: { id: payment.propertyId },
    data: {
      isReserved: true,
      currentReservationBy: payment.userId,
      reservationStartedAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      reservationFeeStatus: 'PAID',
      reservationFeePaidAt: new Date(),
      status: 'PENDING', // Show PENDING to others
    },
  });

  return {
    success: true,
    message: 'Property reserved successfully',
    payment: updatedPayment,
  };
}

// ADD THIS NEW METHOD:
async hasUserActiveReservation(userId: string, propertyId: string): Promise<boolean> {
  const payment = await this.prisma.reservationFeePayment.findFirst({
    where: {
      userId,
      propertyId,
      status: 'SUCCESS',
    },
  });

  if (!payment) return false;

  // Check if reservation expired
  const property = await this.prisma.item.findUnique({
    where: { id: propertyId },
    select: { reservationExpiresAt: true },
  });

  if (!property?.reservationExpiresAt) return false;

  return new Date() < property.reservationExpiresAt;
  }
}