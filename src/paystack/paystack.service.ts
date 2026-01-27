// src/paystack/paystack.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

type PaystackTxnStatus = 'success' | 'failed' | 'abandoned';

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export type PaystackCustomer = Record<string, unknown>;
export type PaystackMetadata = Record<string, unknown>;

export interface PaystackVerifyResponse {
  reference: string;
  status: PaystackTxnStatus;
  amount: number; // in naira
  paidAt: string | null;
  customer: PaystackCustomer | null;
  metadata: PaystackMetadata | null;
}

// ✅ Paystack raw API shape
interface PaystackVerifyApiResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    status: string; // Paystack sends string, we narrow it
    amount: number; // in kobo
    paid_at?: string | null;
    customer?: PaystackCustomer;
    metadata?: PaystackMetadata;
  };
}

@Injectable()
export class PaystackService {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;
  private readonly baseUrl = 'https://api.paystack.co';

  async verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const response = await axios.get<PaystackVerifyApiResponse>(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      const data = response.data.data;

      // Narrow status safely (default to 'failed' if unexpected)
      const status: PaystackTxnStatus =
        data.status === 'success' || data.status === 'failed' || data.status === 'abandoned'
          ? data.status
          : 'failed';

      return {
        reference: data.reference,
        amount: data.amount / 100, // kobo -> naira
        paidAt: data.paid_at ?? null,
        status,
        customer: data.customer ?? null,
        metadata: data.metadata ?? null,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error('Paystack verification error:', err.response?.data || err.message);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async initializePayment(
    email: string,
    amount: number, // naira
    reference: string,
    metadata?: Record<string, unknown>,
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error('Paystack initialization error:', err.response?.data || err.message);
      throw new BadRequestException('Payment initialization failed');
    }
  }
}
