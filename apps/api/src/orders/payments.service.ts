import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { CashShiftsService } from "../cash-shifts/cash-shifts.service";

const ORDER_INCLUDE = { items: true } satisfies Prisma.OrderInclude;

/** Shared money epsilon for paidTotal / refund checks (BE-009). */
const MONEY_EPSILON = 0.01;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway,
    private cashShifts: CashShiftsService,
  ) {}

  /**
   * Create a payment against an order.
   * Idempotent: if idempotencyKey matches an existing payment, returns it.
   * Uses guarded updateMany to prevent race conditions on paidTotal.
   *
   * Authorization:
   *   - Positive amount: any of admin | waiter | cashier.
   *     Cash method additionally requires an open CashShift (auto-claimed).
   *   - Negative amount (refund): admin only. Must link to original payment via refundedPaymentId.
   */
  async createPayment(params: {
    orderId: string;
    amount: number;
    method: "cash" | "card" | "wallet" | "other";
    idempotencyKey: string;
    actorId?: string;
    actorRole?: "admin" | "kitchen_staff" | "waiter" | "cashier";
    reason?: string;
    note?: string;
    refundedPaymentId?: string;
    approvedById?: string;
  }) {
    const { orderId, amount, method, idempotencyKey, actorId, actorRole, reason, note, refundedPaymentId, approvedById } = params;

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException("idempotencyKey is required");
    }

    // Idempotency: check for existing payment with same key
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { order: { include: ORDER_INCLUDE } },
    });
    if (existing) {
      return existing;
    }

    if (amount === 0) {
      throw new BadRequestException("Payment amount must be non-zero");
    }

    if (amount < 0) {
      // Refund policy: admin only, must reference the original payment, must have a reason.
      if (actorRole !== "admin") {
        throw new ForbiddenException("Only admins can post refunds");
      }
      if (!refundedPaymentId) {
        throw new BadRequestException("refundedPaymentId is required for refunds");
      }
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException("Reason is required for refunds");
      }
    }

    // Fetch order and validate
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    if (order.status === "cancelled") {
      throw new BadRequestException("Cannot pay for a cancelled order");
    }

    // If this is a refund against an existing payment, validate the link.
    if (refundedPaymentId) {
      const target = await this.prisma.payment.findUnique({ where: { id: refundedPaymentId } });
      if (!target) throw new NotFoundException("Refunded payment not found");
      if (target.orderId !== orderId) {
        throw new BadRequestException("refundedPaymentId does not belong to this order");
      }
      // Sum of prior refunds against this payment must not exceed target.amount.
      if (new Prisma.Decimal(target.amount).lte(0) || target.refundedPaymentId) {
        throw new BadRequestException("Refund target must be an original positive payment");
      }
      const priorRefunds = await this.prisma.payment.aggregate({
        where: { refundedPaymentId: target.id },
        _sum: { amount: true },
      });
      const remainingAfterRefund = new Prisma.Decimal(target.amount)
        .add(new Prisma.Decimal(priorRefunds._sum.amount ?? 0))
        .add(amount);
      if (remainingAfterRefund.lt(new Prisma.Decimal(-MONEY_EPSILON))) {
        throw new BadRequestException(
          `Refund of ${Math.abs(amount)} exceeds remaining refundable on this payment ` +
          `(${Math.abs(Number(target.amount) + Number(priorRefunds._sum.amount ?? 0))})`
        );
      }
    }

    const orderTotal = Number(order.total);
    const currentPaid = Number(order.paidTotal);

    if (amount > 0) {
      if (currentPaid + amount > orderTotal + MONEY_EPSILON) {
        throw new BadRequestException(
          `Payment of ${amount} would exceed order total of ${orderTotal} (already paid: ${currentPaid})`
        );
      }
    } else {
      // Refund: cannot drive paidTotal below 0.
      if (currentPaid + amount < -MONEY_EPSILON) {
        throw new BadRequestException(
          `Refund of ${Math.abs(amount)} exceeds paid amount of ${currentPaid}`
        );
      }
    }

    // Cash method requires an open shift. Auto-claim the current open shift.
    let cashShiftId: string | undefined;
    if (method === "cash") {
      const open = await this.cashShifts.getCurrentOpen();
      if (!open) {
        throw new BadRequestException(
          "No cash shift is open. Open a shift before posting cash payments or refunds."
        );
      }
      cashShiftId = open.id;
    }

    // Atomic: create payment + update paidTotal + update paymentStatus
    const result = await this.prisma.$transaction(async (tx) => {
      const newPaidTotal = new Prisma.Decimal(currentPaid).add(amount).toDecimalPlaces(2);

      // Phase 0 fix: paymentStatus must reflect the three valid states.
      // paid         -> newPaidTotal >= orderTotal
      // unpaid       -> newPaidTotal <= 0  (after a full refund)
      // partially_paid -> any value strictly between 0 and orderTotal
      const isPaid = newPaidTotal.gte(orderTotal);
      const isUnpaid = newPaidTotal.lte(0);
      const nextStatus: "paid" | "unpaid" | "partially_paid" = isPaid
        ? "paid"
        : isUnpaid
        ? "unpaid"
        : "partially_paid";

      const updateResult = await tx.order.updateMany({
        where: { id: orderId, paidTotal: order.paidTotal },
        data: {
          paidTotal: newPaidTotal,
          paymentStatus: nextStatus,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException("Order was modified concurrently — refresh and retry");
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          amount,
          method,
          idempotencyKey,
          actorId: actorId || null,
          refundedPaymentId: refundedPaymentId || null,
          approvedById: amount < 0 ? (approvedById || actorId || null) : null,
          cashShiftId: cashShiftId || null,
          reason: reason || null,
          note: note || null,
        },
      });

      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });

      return { payment, order: updatedOrder };
    });

    this.wsGateway.broadcastOrderUpdate(result.order!);

    return {
      ...result.payment,
      amount: Number(result.payment.amount),
      order: {
        ...result.order!,
        itemsTotal: Number(result.order!.itemsTotal),
        discountAmount: Number(result.order!.discountAmount),
        taxRate: Number(result.order!.taxRate),
        taxAmount: Number(result.order!.taxAmount),
        serviceRate: Number(result.order!.serviceRate),
        serviceAmount: Number(result.order!.serviceAmount),
        total: Number(result.order!.total),
        paidTotal: Number(result.order!.paidTotal),
        items: result.order!.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
      },
    };
  }

  /**
   * Get all payments for an order.
   */
  async getOrderPayments(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { paidAt: "asc" },
    });

    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  }

  /**
   * Refund against a specific payment. Admin-only.
   * Resolves the orderId from the original payment, then delegates to createPayment.
   */
  async refundPayment(params: {
    refundedPaymentId: string;
    amount: number;
    method?: "cash" | "card" | "wallet" | "other";
    reason: string;
    adminId: string;
  }) {
    const target = await this.prisma.payment.findUnique({
      where: { id: params.refundedPaymentId },
      select: { orderId: true },
    });
    if (!target) throw new NotFoundException("Original payment not found");

    return this.createPayment({
      orderId: target.orderId,
      amount: -Math.abs(params.amount),
      method: params.method || "other",
      idempotencyKey: `refund-${params.refundedPaymentId}-${randomUUID()}`,
      actorId: params.adminId,
      actorRole: "admin",
      approvedById: params.adminId,
      refundedPaymentId: params.refundedPaymentId,
      reason: params.reason,
    });
  }
}
