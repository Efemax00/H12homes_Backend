// src/payment/dto/payment-details.dto.ts
export class PaymentDetailsDto {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
}
