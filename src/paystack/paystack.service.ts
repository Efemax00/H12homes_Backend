// src/paystack/paystack.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

type PaystackTxnStatus = 'success' | 'failed' | 'abandoned';

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  reference: string;
  status: PaystackTxnStatus;
  amount: number; // in naira
  paidAt: string | null;
  customer?: unknown;
  metadata?: unknown;
}

@Injectable()
export class PaystackService {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;
  private readonly baseUrl = 'https://api.paystack.co';

  async verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      const { data } = response.data as { data: any };

      const status = data.status as PaystackTxnStatus;

      // ✅ IMPORTANT: do NOT throw for failed/abandoned
      // only return status so caller decides what to do
      return {
        reference: data.reference,
        amount: data.amount / 100, // kobo -> naira
        paidAt: data.paid_at ?? null,
        status: data.status,
        customer: data.customer,
        metadata: data.metadata,
      };
    } catch (error: any) {
      console.error(
        'Paystack verification error:',
        error?.response?.data || error?.message,
      );
      throw new BadRequestException('Payment verification failed');
    }
  }

  async initializePayment(
    email: string,
    amount: number, // naira
    reference: string,
    metadata?: Record<string, unknown>, // ✅ no any
  ): Promise<PaystackInitializeResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // naira -> kobo
          reference,
          metadata,
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data as PaystackInitializeResponse;
    } catch (error: any) {
      console.error(
        'Paystack initialization error:',
        error?.response?.data || error?.message,
      );
      throw new BadRequestException('Payment initialization failed');
    }
  }
}
