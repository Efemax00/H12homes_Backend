// src/paystack/paystack.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;
  private readonly baseUrl = 'https://api.paystack.co';

  async verifyPayment(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      const { data } = response.data;

      if (data.status !== 'success') {
        throw new BadRequestException('Payment verification failed');
      }

      return {
        reference: data.reference,
        amount: data.amount / 100, // Convert from kobo to naira
        paidAt: data.paid_at,
        customer: data.customer,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new BadRequestException('Payment verification failed');
    }
  }

  // ✅ FIXED: Added metadata as 4th parameter
  async initializePayment(
    email: string,
    amount: number,
    reference: string,
    metadata?: any, // ✅ Added this parameter
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert naira to kobo
          reference,
          metadata, // ✅ Include metadata in request
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data;
    } catch (error) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new BadRequestException('Payment initialization failed');
    }
  }
}