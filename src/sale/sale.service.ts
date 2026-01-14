// src/sale/sale.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkSaleDto } from './dto/mark-sale.dto';
import { Role, FinanceStatus, SaleStatus, CommissionStatus, ItemStatus  } from '@prisma/client';
import { ReviewSaleDto } from './dto/review-sale.dto';

@Injectable()
export class SaleService {
  constructor(private prisma: PrismaService) {}

  async markAsSold(adminId: string, adminRole: Role, dto: MarkSaleDto) {
    if (adminRole !== Role.ADMIN && adminRole !== Role.SUPER_ADMIN && adminRole !== Role.SELLER) {
      throw new ForbiddenException('Only admins/agents can mark a sale.');
    }

    const property = await this.prisma.item.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Optional: verify that this admin actually owns/listed this property
    if (property.ownerId !== adminId && adminRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You are not allowed to mark this property as sold.');
    }

    // Optional: check that buyer exists
    const buyer = await this.prisma.user.findUnique({
      where: { id: dto.buyerId },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    // Create new Sale (you can later enforce uniqueness if needed)
    const sale = await this.prisma.sale.create({
      data: {
        propertyId: dto.propertyId,
        buyerId: dto.buyerId,
        sellerId: adminId,
        amount: dto.amount,
        paymentProofUrl: dto.paymentProofUrl,
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference,
        notes: dto.notes,

        // Manual phase logic:
        status: SaleStatus.PAYMENT_SUBMITTED,
        financeStatus: FinanceStatus.PENDING,
        markedSoldAt: new Date(),

        // Not yet confirmed by finance:
        companyAccountPaid: false,
      },
    });

    // Optional: update property status to SOLD or maybe PENDING_CONFIRMATION
    await this.prisma.item.update({
      where: { id: dto.propertyId },
      data: {
        status: ItemStatus.SOLD, // or keep AVAILABLE until finance confirms – up to you
      },
    });

    // Optional: log audit
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'MARK_SALE_SUBMITTED',
        entityType: 'Sale',
        entityId: sale.id,
        metadata: {
          propertyId: dto.propertyId,
          buyerId: dto.buyerId,
          amount: dto.amount,
        },
      },
    });

    return sale;
  }

   async reviewSale(financeUserId: string, financeUserRole: Role, dto: ReviewSaleDto) {
    // You may choose to restrict this to SUPER_ADMIN or a special FINANCE role later
    if (financeUserRole !== Role.ADMIN && financeUserRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only finance/admin can review sales.');
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
    });

    if (!sale) throw new NotFoundException('Sale not found');

    if (sale.financeStatus !== FinanceStatus.PENDING) {
      throw new ForbiddenException('Sale already reviewed.');
    }

    const updated = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        financeStatus: dto.financeStatus,
        financeReviewedById: financeUserId,
        financeReviewedAt: new Date(),
        financeComment: dto.financeComment,
        status:
          dto.financeStatus === FinanceStatus.CONFIRMED
            ? SaleStatus.CONFIRMED
            : SaleStatus.DISPUTED,
        companyAccountPaid: dto.financeStatus === FinanceStatus.CONFIRMED,
      },
    });

    if (dto.financeStatus === FinanceStatus.CONFIRMED) {
      // Create commission record for the admin/seller
      await this.prisma.commission.create({
        data: {
          saleId: sale.id,
          adminId: sale.sellerId,
          amount: this.calculateCommissionAmount(sale.amount), // you can implement your formula
          status: CommissionStatus.PENDING,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: financeUserId,
        action: 'REVIEW_SALE',
        entityType: 'Sale',
        entityId: sale.id,
        metadata: {
          oldFinanceStatus: sale.financeStatus,
          newFinanceStatus: dto.financeStatus,
          comment: dto.financeComment,
        },
      },
    });

    return updated;
  }

  private calculateCommissionAmount(amount: number): number {
    // example: 3% commission
    return amount * 0.03;
  }
}
