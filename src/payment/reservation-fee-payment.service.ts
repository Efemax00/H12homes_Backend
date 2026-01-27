import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from '../paystack/paystack.service';

@Injectable()
export class ReservationFeePaymentService {
  // Reservation fee amount
  private readonly RESERVATION_FEE_AMOUNT = 10000; // ₦10,000
  private readonly RESERVATION_PERIOD_DAYS = 7; // 7 days

  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
  ) {}

  async initializeReservationFee(userId: string, propertyId: string) {
    // 1. Get property details
    const property = await this.prisma.item.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        agentId: true,
        createdBy: true,
        isReserved: true,
        currentReservationBy: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // 2. Check if already reserved by ANOTHER user
    if (property.isReserved && property.currentReservationBy !== userId) {
      throw new BadRequestException(
        'Property is already reserved by another user',
      );
    }

    // 3. Check if THIS user already has active reservation
    if (property.isReserved && property.currentReservationBy === userId) {
      throw new BadRequestException(
        'You already have an active reservation for this property',
      );
    }

    // 4. Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 5. Generate unique reference
    const amount = this.RESERVATION_FEE_AMOUNT;
    const reference = `RSV-${Date.now()}-${userId.substring(0, 8)}`;

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
        type: 'reservation_fee',
      },
    );

    // 7. Create reservation fee payment record
    await this.prisma.reservationFeePayment.create({
      data: {
        userId,
        propertyId,
        amount,
        paystackReference: reference,
        status: 'PENDING',
        h12KeepsAmount: amount, // H12 keeps 100%
        metadata: {
          propertyTitle: property.title,
          propertyPrice: property.price,
          propertyLocation: property.location,
        },
      },
    });

    return {
      authorizationUrl: paymentData.authorization_url,
      accessCode: paymentData.access_code,
      reference: paymentData.reference,
      amount,
      expiresIn: `${this.RESERVATION_PERIOD_DAYS} days`,
    };
  }

  async verifyReservationFee(reference: string) {
    // 1. Verify payment with Paystack
    const verified = await this.paystack.verifyPayment(reference);

    // 2. Find payment record
    const payment = await this.prisma.reservationFeePayment.findUnique({
      where: { paystackReference: reference },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            isReserved: true,
            currentReservationBy: true,
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

    // after verified = await this.paystack.verifyPayment(reference);

if (verified.status !== 'success') {
  // mark FAILED (or keep PENDING), but DO NOT reserve
  await this.prisma.reservationFeePayment.update({
    where: { paystackReference: reference },
    data: {
      status: 'FAILED',
      metadata: {
        ...(payment.metadata as any),
        verifyStatus: verified.status,
      },
    },
  });

  throw new BadRequestException(`Payment not successful: ${verified.status}`);
}


    // 4. Double-check property is still available (in case it was reserved elsewhere)
    if (
      payment.property.isReserved &&
      payment.property.currentReservationBy !== payment.userId
    ) {
      throw new BadRequestException(
        'Property has been reserved by another user. Payment cancelled.',
      );
    }

    // 5. Update payment status to SUCCESS
    const updatedPayment = await this.prisma.reservationFeePayment.update({
      where: { paystackReference: reference },
      data: {
        status: 'SUCCESS',
        paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),

      },
    });

    // 6. Lock the property (reserve it for this user)
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + this.RESERVATION_PERIOD_DAYS,
    );

    await this.prisma.item.update({
      where: { id: payment.propertyId },
      data: {
        isReserved: true,
        currentReservationBy: payment.userId,
        reservationStartedAt: new Date(),
        reservationExpiresAt: expiresAt,
        reservationFeeStatus: 'PAID',
        reservationFeePaidAt: new Date(),
        status: 'PENDING', // Property shows PENDING to other users
      },
    });

    // 7. Track engagement analytics
    await this.prisma.propertyEngagement.create({
      data: {
        propertyId: payment.propertyId,
        userId: payment.userId,
        actionType: 'CLICKED_INTERESTED',
        metadata: {
          reservationFeePaid: true,
          amount: payment.amount,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return {
      success: true,
      message: 'Property reserved successfully for 7 days',
      payment: updatedPayment,
      reservation: {
        reservedUntil: expiresAt,
        daysRemaining: this.RESERVATION_PERIOD_DAYS,
      },
    };
  }

  async hasUserActiveReservation(
    userId: string,
    propertyId: string,
  ): Promise<boolean> {
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

  async getReservationStatus(userId: string, propertyId: string) {
    const payment = await this.prisma.reservationFeePayment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'SUCCESS',
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            reservationExpiresAt: true,
          },
        },
      },
    });

    if (!payment) {
      return {
        hasReservation: false,
        message: 'No active reservation',
      };
    }

    const now = new Date();
    const expiresAt = payment.property.reservationExpiresAt;

    if (!expiresAt || now > expiresAt) {
      return {
        hasReservation: false,
        message: 'Reservation has expired',
        expiredAt: expiresAt,
      };
    }

    const daysRemaining = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      hasReservation: true,
      paymentStatus: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,
      expiresAt,
      daysRemaining,
    };
  }

  async cancelReservation(
    userId: string,
    propertyId: string,
    reason?: string,
  ) {
    // Get active reservation
    const payment = await this.prisma.reservationFeePayment.findFirst({
      where: {
        userId,
        propertyId,
        status: 'SUCCESS',
      },
      include: {
        property: {
          select: {
            id: true,
            currentReservationBy: true,
            reservationExpiresAt: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('No active reservation found');
    }

    // Check if user owns this reservation
    if (payment.property.currentReservationBy !== userId) {
      throw new BadRequestException(
        'You do not own this reservation',
      );
    }

    // Release the property
    await this.prisma.item.update({
      where: { id: propertyId },
      data: {
        isReserved: false,
        currentReservationBy: null,
        reservationStartedAt: null,
        reservationExpiresAt: null,
        status: 'AVAILABLE',
      },
    });

    return {
      message: 'Reservation cancelled',
      amount: payment.amount,
      note: 'Reservation fee (₦10,000) is non-refundable',
      reason: reason || 'User cancelled reservation',
    };
  }

  async getUserReservations(userId: string) {
    return this.prisma.reservationFeePayment.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            isReserved: true,
            reservationExpiresAt: true,
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