import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { CashShiftsService } from "../cash-shifts/cash-shifts.service";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let prisma: {
    order: { findUnique: jest.Mock; updateMany: jest.Mock };
    payment: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    $transaction: jest.Mock;
  };
  let wsGateway: { broadcastOrderUpdate: jest.Mock };
  let cashShifts: { getCurrentOpen: jest.Mock };

  interface CapturedUpdateArgs {
    data: { paymentStatus?: string; [key: string]: unknown };
  }

  const mockOrder = {
    id: "order-1",
    orderNumber: "1001",
    total: 100,
    paidTotal: 0,
    paymentStatus: "unpaid",
    status: "ready",
    items: [],
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(mockOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    wsGateway = { broadcastOrderUpdate: jest.fn() };
    cashShifts = { getCurrentOpen: jest.fn().mockResolvedValue({ id: "shift-1" }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: WebsocketGateway, useValue: wsGateway },
        { provide: CashShiftsService, useValue: cashShifts },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe("createPayment", () => {
    it("creates a payment and updates order paidTotal", async () => {
      const payment = { id: "pay-1", amount: 50, method: "cash", idempotencyKey: "key-1" };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, paidTotal: 50, items: [] }),
          },
          payment: { create: jest.fn().mockResolvedValue(payment) },
        };
        return fn(tx);
      });

      const result = await service.createPayment({
        orderId: "order-1",
        amount: 50,
        method: "cash",
        idempotencyKey: "key-1",
      });

      expect(result.amount).toBe(50);
      expect(wsGateway.broadcastOrderUpdate).toHaveBeenCalled();
    });

    it("rejects empty idempotencyKey", async () => {
      await expect(
        service.createPayment({ orderId: "order-1", amount: 50, method: "cash", idempotencyKey: "" })
      ).rejects.toThrow(BadRequestException);
    });

    it("returns existing payment on idempotent retry", async () => {
      const existingPayment = { id: "pay-1", amount: 50, method: "cash", order: mockOrder };
      prisma.payment.findUnique.mockResolvedValue(existingPayment);

      const result = await service.createPayment({
        orderId: "order-1",
        amount: 50,
        method: "cash",
        idempotencyKey: "key-1",
      });

      expect(result.id).toBe("pay-1");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects payment exceeding order total", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, total: 100, paidTotal: 80 });

      await expect(
        service.createPayment({ orderId: "order-1", amount: 30, method: "cash", idempotencyKey: "k1" })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects refund without reason", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, total: 100, paidTotal: 100 });

      await expect(
        service.createPayment({ orderId: "order-1", amount: -20, method: "cash", idempotencyKey: "k1", actorRole: "admin", refundedPaymentId: "pay-1" })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a cash refund when no cash shift is open", async () => {
      cashShifts.getCurrentOpen.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, total: 100, paidTotal: 100 });
      prisma.payment.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "pay-1", orderId: "order-1", amount: 100, refundedPaymentId: null });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await expect(
        service.createPayment({
          orderId: "order-1",
          amount: -20,
          method: "cash",
          idempotencyKey: "refund-key",
          actorRole: "admin",
          refundedPaymentId: "pay-1",
          reason: "Customer request",
        })
      ).rejects.toThrow("No cash shift is open");
    });

    it("rejects payment on cancelled order", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "cancelled" });

      await expect(
        service.createPayment({ orderId: "order-1", amount: 50, method: "cash", idempotencyKey: "k1" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException on concurrent paidTotal modification", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findUnique: jest.fn(),
          },
          payment: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        service.createPayment({ orderId: "order-1", amount: 50, method: "cash", idempotencyKey: "k1" })
      ).rejects.toThrow(ConflictException);
    });

    it("marks order as paid when paidTotal reaches total", async () => {
      let capturedUpdate!: CapturedUpdateArgs;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          order: {
            updateMany: jest.fn().mockImplementation((args: CapturedUpdateArgs) => {
              capturedUpdate = args;
              return Promise.resolve({ count: 1 });
            }),
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, paidTotal: 100, items: [] }),
          },
          payment: { create: jest.fn().mockResolvedValue({ id: "pay-1" }) },
        };
        return fn(tx);
      });

      await service.createPayment({
        orderId: "order-1",
        amount: 100,
        method: "cash",
        idempotencyKey: "k1",
      });

      expect(capturedUpdate.data.paymentStatus).toBe("paid");
    });

    // Phase 0: regression test for the paymentStatus ternary bug.
    // All three states must be writable, not just paid/unpaid.
    describe("paymentStatus state derivation (Phase 0 fix)", () => {
      async function captureStatus(
        amount: number,
        currentPaid: number,
        orderTotal: number,
        refundOpts?: { actorRole: "admin" | "waiter" | "cashier"; refundedPaymentId: string; reason: string }
      ) {
        let captured!: CapturedUpdateArgs;
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          total: orderTotal,
          paidTotal: currentPaid,
        });
        // For refunds, the service also looks up the target payment
        if (refundOpts) {
          prisma.payment.findUnique
            .mockResolvedValueOnce(null) // idempotency check
            .mockResolvedValueOnce({
              id: refundOpts.refundedPaymentId,
              orderId: "order-1",
              amount: 100,
              refundedPaymentId: null,
            });
          prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
        }
        prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            order: {
              updateMany: jest.fn().mockImplementation((args: CapturedUpdateArgs) => {
                captured = args;
                return Promise.resolve({ count: 1 });
              }),
              findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
            },
            payment: { create: jest.fn().mockResolvedValue({ id: "pay-x" }) },
          };
          return fn(tx);
        });
        await service.createPayment({
          orderId: "order-1",
          amount,
          method: "cash",
          idempotencyKey: `phase0-${amount}-${currentPaid}-${orderTotal}-${refundOpts?.refundedPaymentId ?? "no"}`,
          ...(refundOpts ?? {}),
        });
        return captured.data.paymentStatus;
      }

      it("writes 'paid' when new paidTotal equals orderTotal", async () => {
        expect(await captureStatus(100, 0, 100)).toBe("paid");
      });

      it("writes 'partially_paid' when new paidTotal is between 0 and total", async () => {
        expect(await captureStatus(30, 0, 100)).toBe("partially_paid");
        expect(await captureStatus(40, 30, 100)).toBe("partially_paid");
      });

      it("writes 'unpaid' when a full refund drives paidTotal back to 0", async () => {
        // 100 paid - 100 refund = 0
        expect(
          await captureStatus(-100, 100, 100, {
            actorRole: "admin",
            refundedPaymentId: "pay-target",
            reason: "Customer return",
          })
        ).toBe("unpaid");
      });

      it("writes 'partially_paid' when a partial refund leaves a positive balance", async () => {
        // 100 paid - 40 refund = 60 (still > 0, < total)
        expect(
          await captureStatus(-40, 100, 100, {
            actorRole: "admin",
            refundedPaymentId: "pay-target",
            reason: "Partial return",
          })
        ).toBe("partially_paid");
      });
    });
  });

  describe("getOrderPayments", () => {
    it("returns payments for an order", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order-1" });
      prisma.payment.findMany.mockResolvedValue([
        { id: "pay-1", amount: 50, method: "cash" },
        { id: "pay-2", amount: 50, method: "card" },
      ]);

      const result = await service.getOrderPayments("order-1");
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(50);
    });

    it("throws NotFoundException for unknown order", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.getOrderPayments("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });
});
