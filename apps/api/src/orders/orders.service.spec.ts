import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { OrdersService, rebaseTaxAfterDiscount } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { StockService } from "../inventory/stock.service";
import { PaymentsService } from "./payments.service";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: {
    order: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
    menuItem: { findMany: jest.Mock };
    orderCounter: { upsert: jest.Mock };
    restaurantSettings: { findUnique: jest.Mock };
    payment: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let wsGateway: { broadcastNewOrder: jest.Mock; broadcastOrderUpdate: jest.Mock };
  let stockService: { consumeForSale: jest.Mock };
  let paymentsService: { createPayment: jest.Mock; getOrderPayments: jest.Mock };

  interface MockOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    phone: string | null;
    orderType: string;
    tableNumber: number | null;
    notes: string | null;
    status: string;
    paymentStatus: string;
    billRequested: boolean;
    createdAt: Date;
    updatedAt: Date;
    itemsTotal: number;
    discountAmount: number;
    taxRate: number;
    taxAmount: number;
    serviceRate: number;
    serviceAmount: number;
    total: number;
    paidTotal: number;
    legacyBackfilled: boolean;
    items: { menuItemId: string; quantity: number; variant?: string }[];
  }

  interface OrderCreateData {
    items: { create: { unitPrice: number; nameEn: string }[] };
    itemsTotal: { toString(): string };
    taxAmount: { toString(): string };
    taxRate: { toString(): string };
    serviceAmount: { toString(): string };
    serviceRate: { toString(): string };
    total: { toString(): string };
  }

  interface CapturedUpdateManyArgs {
    where: Record<string, unknown>;
    data: Record<string, unknown> & {
      status?: string;
      preparingById?: string;
      preparingAt?: Date;
      cancelReason?: string;
      cancelledById?: string;
      cancelledAt?: Date;
    };
  }

  const mockOrder: MockOrder = {
    id: "order-1",
    orderNumber: "1001",
    customerName: "Test Customer",
    phone: null,
    orderType: "dine_in",
    tableNumber: 5,
    notes: null,
    status: "received",
    paymentStatus: "unpaid",
    billRequested: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    itemsTotal: 50,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    serviceRate: 0,
    serviceAmount: 0,
    total: 50,
    paidTotal: 0,
    legacyBackfilled: false,
    items: [],
  };

  const defaultSettings = {
    taxEnabled: false,
    taxRate: 0,
    serviceEnabled: false,
    serviceRate: 0,
  };

  const menuItem = {
    id: "m1",
    nameAr: "طبق",
    nameEn: "Dish",
    price: 50,
    available: true,
    deletedAt: null,
    variants: [
      { nameEn: "Large", nameAr: "كبير", priceAdjust: 10 },
      { nameEn: "Jumbo", nameAr: "ضخم", priceAdjust: { toNumber: () => 25 } },
    ],
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      menuItem: { findMany: jest.fn() },
      orderCounter: { upsert: jest.fn() },
      restaurantSettings: { findUnique: jest.fn().mockResolvedValue(defaultSettings) },
      payment: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    wsGateway = {
      broadcastNewOrder: jest.fn(),
      broadcastOrderUpdate: jest.fn(),
    };
    stockService = { consumeForSale: jest.fn().mockResolvedValue({ consumed: [] }) };
    paymentsService = { createPayment: jest.fn(), getOrderPayments: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WebsocketGateway, useValue: wsGateway },
        { provide: StockService, useValue: stockService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe("create — server-authoritative pricing (SEC-1)", () => {
    it("creates an order with atomic order number and money snapshot", async () => {
      prisma.menuItem.findMany.mockResolvedValue([menuItem]);
      const createdOrder = { ...mockOrder, items: [] };

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          orderCounter: { upsert: jest.fn().mockResolvedValue({ value: 1001 }) },
          restaurantSettings: { findUnique: jest.fn().mockResolvedValue(defaultSettings) },
          order: { create: jest.fn().mockResolvedValue(createdOrder) },
        })
      );

      const result = await service.create({
        customerName: "Test Customer",
        orderType: "dine_in",
        tableNumber: 5,
        items: [{ menuItemId: "m1", quantity: 1 }],
      });

      expect(result.orderNumber).toBe("1001");
      expect(wsGateway.broadcastNewOrder).toHaveBeenCalledWith(createdOrder);
    });

    it("computes unitPrice from DB price + variant priceAdjust (Decimal-safe)", async () => {
      prisma.menuItem.findMany.mockResolvedValue([menuItem]);
      let capturedData!: OrderCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          orderCounter: { upsert: jest.fn().mockResolvedValue({ value: 1001 }) },
          restaurantSettings: { findUnique: jest.fn().mockResolvedValue(defaultSettings) },
          order: {
            create: jest.fn().mockImplementation(({ data }: { data: OrderCreateData }) => {
              capturedData = data;
              return { ...mockOrder, items: [] };
            }),
          },
        })
      );

      await service.create({
        customerName: "C",
        orderType: "takeaway",
        items: [
          { menuItemId: "m1", quantity: 1 },
          { menuItemId: "m1", quantity: 1, variant: "Large" },
          { menuItemId: "m1", quantity: 1, variant: "Jumbo" },
        ],
      });

      const [plain, large, jumbo] = capturedData.items.create;
      expect(plain.unitPrice).toBe(50);
      expect(plain.nameEn).toBe("Dish");
      expect(large.unitPrice).toBe(60);
      expect(jumbo.unitPrice).toBe(75);
    });

    it("computes money snapshot with tax and service when enabled", async () => {
      const settingsWithTax = {
        taxEnabled: true,
        taxRate: 0.15,
        serviceEnabled: true,
        serviceRate: 0.10,
      };
      prisma.menuItem.findMany.mockResolvedValue([menuItem]);
      let capturedData!: OrderCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          orderCounter: { upsert: jest.fn().mockResolvedValue({ value: 1001 }) },
          restaurantSettings: { findUnique: jest.fn().mockResolvedValue(settingsWithTax) },
          order: {
            create: jest.fn().mockImplementation(({ data }: { data: OrderCreateData }) => {
              capturedData = data;
              return { ...mockOrder, items: [] };
            }),
          },
        })
      );

      await service.create({
        customerName: "C",
        orderType: "takeaway",
        items: [{ menuItemId: "m1", quantity: 2 }],
      });

      // itemsTotal = 50 * 2 = 100
      expect(capturedData.itemsTotal.toString()).toBe("100");
      // taxAmount = 100 * 0.15 = 15
      expect(capturedData.taxAmount.toString()).toBe("15");
      expect(capturedData.taxRate.toString()).toBe("0.15");
      // serviceAmount = 100 * 0.10 = 10
      expect(capturedData.serviceAmount.toString()).toBe("10");
      expect(capturedData.serviceRate.toString()).toBe("0.1");
      // total = 100 + 15 + 10 = 125
      expect(capturedData.total.toString()).toBe("125");
    });

    it("rejects unknown menu items with BadRequestException", async () => {
      prisma.menuItem.findMany.mockResolvedValue([]);

      await expect(
        service.create({
          customerName: "C",
          orderType: "takeaway",
          items: [{ menuItemId: "ghost-id", quantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects unavailable items", async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ ...menuItem, available: false }]);

      await expect(
        service.create({
          customerName: "C",
          orderType: "takeaway",
          items: [{ menuItemId: "m1", quantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects unknown variant labels", async () => {
      prisma.menuItem.findMany.mockResolvedValue([menuItem]);

      await expect(
        service.create({
          customerName: "C",
          orderType: "takeaway",
          items: [{ menuItemId: "m1", quantity: 1, variant: "Fake Size" }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for empty items", async () => {
      await expect(
        service.create({
          customerName: "Test",
          orderType: "takeaway",
          items: [],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for dine-in without table number", async () => {
      await expect(
        service.create({
          customerName: "Test",
          orderType: "dine_in",
          tableNumber: undefined,
          items: [{ menuItemId: "m1", quantity: 1 }],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll — pagination", () => {
    it("clamps take to [1..500]", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.findAll({ take: 9999 });
      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));

      prisma.order.findMany.mockClear();
      prisma.order.findMany.mockResolvedValue([]);
      await service.findAll({ take: -5 });
      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
    });

    it("rejects invalid status filters", async () => {
      await expect(service.findAll({ status: "banana" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateStatus — race-safe transitions", () => {
    function txForTransition(currentStatus: string | null, finalOrder: typeof mockOrder) {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce(currentStatus === null ? null : { status: currentStatus })
              .mockResolvedValue(finalOrder),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        })
      );
    }

    it("transitions received → preparing and stamps stage actor + timestamp", async () => {
      const orderWithItems = { ...mockOrder, status: "preparing", items: [{ menuItemId: "m1", quantity: 2 }] };
      txForTransition("received", orderWithItems);

      const result = await service.updateStatus("order-1", "preparing", "staff-1");

      expect(result.status).toBe("preparing");
      // Product decision: inventory is manual — stock is NOT auto-consumed on preparing.
      expect(stockService.consumeForSale).not.toHaveBeenCalled();
      expect(wsGateway.broadcastOrderUpdate).toHaveBeenCalled();
    });

    it("does NOT call stock consumption for non-preparing transitions", async () => {
      txForTransition("preparing", { ...mockOrder, status: "ready", items: [{ menuItemId: "m1", quantity: 1 }] });

      await service.updateStatus("order-1", "ready", "staff-1");

      expect(stockService.consumeForSale).not.toHaveBeenCalled();
    });

    it("writes preparingAt/preparingById on the guarded updateMany", async () => {
      txForTransition("received", { ...mockOrder, status: "preparing" });
      let capturedArgs!: CapturedUpdateManyArgs;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          order: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({ status: "received" })
              .mockResolvedValue({ ...mockOrder, status: "preparing" }),
            updateMany: jest.fn().mockImplementation((args: CapturedUpdateManyArgs) => {
              capturedArgs = args;
              return Promise.resolve({ count: 1 });
            }),
          },
        };
        return fn(txClient);
      });

      await service.updateStatus("order-1", "preparing", "staff-9");

      expect(capturedArgs.where).toEqual({ id: "order-1", status: "received" });
      expect(capturedArgs.data.status).toBe("preparing");
      expect(capturedArgs.data.preparingById).toBe("staff-9");
      expect(capturedArgs.data.preparingAt).toBeInstanceOf(Date);
    });

    it("rejects backward transitions (completed → received)", async () => {
      txForTransition("completed", mockOrder);

      await expect(service.updateStatus("order-1", "received")).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects staying at the same status", async () => {
      txForTransition("preparing", mockOrder);

      await expect(service.updateStatus("order-1", "preparing")).rejects.toThrow(
        BadRequestException
      );
    });

    it("allows forward jumps (received → ready)", async () => {
      txForTransition("received", { ...mockOrder, status: "ready" });

      const result = await service.updateStatus("order-1", "ready");
      expect(result.status).toBe("ready");
    });

    it("throws ConflictException when a concurrent writer wins the guarded update", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "received" }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }), // lost the race
          },
        })
      );

      await expect(service.updateStatus("order-1", "ready")).rejects.toThrow(
        ConflictException
      );
    });

    it("refuses to progress cancelled orders", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "cancelled" }),
            updateMany: jest.fn(),
          },
        })
      );

      await expect(service.updateStatus("order-1", "ready")).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws NotFoundException for non-existent order", async () => {
      txForTransition(null, mockOrder);

      await expect(service.updateStatus("nonexistent", "preparing")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("cancel — admin cancellation (A3/A4)", () => {
    it("cancels a received order with reason + actor stamped", async () => {
      let capturedArgs!: CapturedUpdateManyArgs;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({ status: "received" })
              .mockResolvedValue({ ...mockOrder, status: "cancelled" }),
            updateMany: jest.fn().mockImplementation((args: CapturedUpdateManyArgs) => {
              capturedArgs = args;
              return Promise.resolve({ count: 1 });
            }),
          },
        })
      );

      const result = await service.cancel("order-1", "Customer left", "admin-1");

      expect(result.status).toBe("cancelled");
      expect(capturedArgs.data.cancelReason).toBe("Customer left");
      expect(capturedArgs.data.cancelledById).toBe("admin-1");
      expect(capturedArgs.data.cancelledAt).toBeInstanceOf(Date);
    });

    it("requires a reason", async () => {
      await expect(service.cancel("order-1", "   ", "admin-1")).rejects.toThrow(
        BadRequestException
      );
    });

    it("refuses to cancel completed orders", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "completed" }),
            updateMany: jest.fn(),
          },
        })
      );

      await expect(service.cancel("order-1", "reason", "admin-1")).rejects.toThrow(
        BadRequestException
      );
    });

    it("refuses to cancel ready orders (BE-006: only received/preparing)", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "ready" }),
            updateMany: jest.fn(),
          },
        })
      );

      await expect(service.cancel("order-1", "reason", "admin-1")).rejects.toThrow(
        "Only received or preparing orders can be cancelled"
      );
    });

    it("cancels a preparing order", async () => {
      let capturedArgs!: CapturedUpdateManyArgs;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({ status: "preparing" })
              .mockResolvedValue({ ...mockOrder, status: "cancelled" }),
            updateMany: jest.fn().mockImplementation((args: CapturedUpdateManyArgs) => {
              capturedArgs = args;
              return Promise.resolve({ count: 1 });
            }),
          },
        })
      );

      const result = await service.cancel("order-1", "Kitchen overflow", "admin-1");
      expect(result.status).toBe("cancelled");
      expect(capturedArgs.data.cancelReason).toBe("Kitchen overflow");
    });

    it("refuses double-cancel", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "cancelled" }),
            updateMany: jest.fn(),
          },
        })
      );

      await expect(service.cancel("order-1", "reason", "admin-1")).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws ConflictException on concurrent modification", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({ status: "received" }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        })
      );

      await expect(service.cancel("order-1", "reason", "admin-1")).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe("acknowledgeBill", () => {
    it("should create a cash payment for remaining balance via PaymentsService", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: "order-1", paymentStatus: "unpaid", status: "ready", total: 100, paidTotal: 0 })
        .mockResolvedValueOnce({
          ...mockOrder,
          total: 100,
          paidTotal: 100,
          billRequested: false,
          paymentStatus: "paid",
          items: [],
        });
      prisma.order.update.mockResolvedValue({ billRequested: false });

      paymentsService.createPayment.mockResolvedValue({ id: "pay-1", amount: 100, method: "cash" });

      const result = await service.acknowledgeBill("order-1");

      expect(result.paymentStatus).toBe("paid");
      expect(paymentsService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: "order-1", amount: 100, method: "cash" })
      );
    });

    it("should throw NotFoundException for non-existent order", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.acknowledgeBill("nonexistent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw if already paid", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1", paymentStatus: "paid", status: "ready", total: 100, paidTotal: 100,
      });

      await expect(service.acknowledgeBill("order-1")).rejects.toThrow(BadRequestException);
    });

    it("should throw if order is cancelled", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1", paymentStatus: "unpaid", status: "cancelled", total: 100, paidTotal: 0,
      });

      await expect(service.acknowledgeBill("order-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("applyDiscount", () => {
    it("rejects a discount after payment has been recorded", async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: {
            findUnique: jest.fn().mockResolvedValue({
              id: "order-1",
              itemsTotal: 100,
              taxAmount: 0,
              serviceAmount: 0,
              paidTotal: 25,
              status: "ready",
            }),
          },
        })
      );

      await expect(service.applyDiscount("order-1", 10, "Manager approval", "admin-1"))
        .rejects.toThrow("Cannot apply a discount after payment has been recorded");
    });
  });

  describe("rebaseTaxAfterDiscount (BE-005)", () => {
    it("rebases tax and service on the discounted base", () => {
      const r = rebaseTaxAfterDiscount(80, 0.14, 0.1);
      expect(r.taxAmount).toBe(11.2);
      expect(r.serviceAmount).toBe(8);
      expect(r.total).toBe(99.2);
    });

    it("keeps zero rates as pure subtraction", () => {
      const r = rebaseTaxAfterDiscount(45, 0, 0);
      expect(r.taxAmount).toBe(0);
      expect(r.serviceAmount).toBe(0);
      expect(r.total).toBe(45);
    });

    it("rounds money to 2 decimals", () => {
      const r = rebaseTaxAfterDiscount(33.33, 0.14, 0.05);
      expect(r.taxAmount).toBe(4.67);
      expect(r.serviceAmount).toBe(1.67);
      expect(r.total).toBe(39.67);
    });
  });

  describe("requestBillByNumber", () => {
    it("should set billRequested to true", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        paymentStatus: "unpaid",
        status: "received",
      });
      prisma.order.update.mockResolvedValue({ ...mockOrder, billRequested: true });

      const result = await service.requestBillByNumber("1001");

      expect(result.billRequested).toBe(true);
      expect(wsGateway.broadcastOrderUpdate).toHaveBeenCalled();
    });

    it("refuses bill requests on paid orders", async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: "order-1",
        paymentStatus: "paid",
        status: "ready",
      });

      await expect(service.requestBillByNumber("1001")).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw NotFoundException for non-existent order number", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.requestBillByNumber("9999")).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
