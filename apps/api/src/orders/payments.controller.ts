import { Controller, Get, Post, Body, Param, UseGuards, BadRequestException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PaymentsService } from "./payments.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { IsString, IsNumber, IsOptional, IsIn, IsNotEmpty, Min, MaxLength, IsPositive } from "class-validator";
import { randomUUID } from "crypto";

class CreatePaymentDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsIn(["cash", "card", "wallet", "other"]) method!: string;
  @IsString() @IsOptional() @MaxLength(100) idempotencyKey?: string;
  @IsString() @IsOptional() @MaxLength(280) reason?: string;
  @IsString() @IsOptional() @MaxLength(280) note?: string;
}

class RefundPaymentDto {
  @IsString() refundedPaymentId!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @IsOptional() @IsIn(["cash", "card", "wallet", "other"]) method?: string;
  @IsString() @IsNotEmpty() @MaxLength(280) reason!: string;
}

@Controller("orders")
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  /**
   * Create a payment against an order.
   * Refunds (negative amount) are NOT accepted here — admins use POST /orders/payments/:paymentId/refund.
   */
  @Roles("admin", "waiter", "cashier")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post(":id/payments")
  createPayment(
    @Param("id") orderId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: { id: string; role: "admin" | "waiter" | "cashier" | "kitchen_staff" },
  ) {
    if (dto.amount < 0) {
      throw new BadRequestException(
        "Refunds are not accepted here. Admins should use POST /orders/payments/:paymentId/refund."
      );
    }
    const idempotencyKey = dto.idempotencyKey || randomUUID();
    return this.paymentsService.createPayment({
      orderId,
      amount: dto.amount,
      method: dto.method as "cash" | "card" | "wallet" | "other",
      idempotencyKey,
      actorId: user?.id,
      actorRole: user?.role,
      reason: dto.reason,
      note: dto.note,
    });
  }

  /**
   * Admin-only refund. Links back to the original payment via refundedPaymentId,
   * captures the approving admin in approvedById, requires a reason.
   */
  @Roles("admin")
  @Post("payments/:paymentId/refund")
  refundPayment(
    @Param("paymentId") paymentId: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.refundPayment({
      refundedPaymentId: paymentId,
      amount: dto.amount,
      method: (dto.method || "other") as "cash" | "card" | "wallet" | "other",
      reason: dto.reason,
      adminId: user.id,
    });
  }

  @Roles("admin", "waiter", "kitchen_staff")
  @Get(":id/payments")
  getOrderPayments(@Param("id") orderId: string) {
    return this.paymentsService.getOrderPayments(orderId);
  }
}
