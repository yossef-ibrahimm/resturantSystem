import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { StockService } from "./stock.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

describe("StockService", () => {
  let service: StockService;
  let prisma: {
    inventoryItem: { findFirst: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    stockMovement: { create: jest.Mock; findFirst: jest.Mock };
    recipeLine: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  interface MovementCreateData {
    unitCost?: number;
    totalCost?: number;
    quantity: number | { toString(): string };
    reason?: string;
    type?: string;
    qtyBefore: { toString(): string };
  }

  const mockItem = {
    id: "item-1",
    categoryId: "cat-1",
    nameAr: "lb",
    nameEn: "Milk",
    unit: "ml",
    qtyOnHand: { toNumber: () => 1000, toString: () => "1000" },
    minQty: { toNumber: () => 200, toString: () => "200" },
    reorderPoint: { toNumber: () => 500, toString: () => "500" },
    avgUnitCost: { toNumber: () => 0.5, toString: () => "0.5" },
    active: true,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      recipeLine: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { create: jest.fn(), resolveBySource: jest.fn() } },
      ],
    }).compile();

    service = module.get(StockService);
  });

  describe("addStock", () => {
    it("throws if quantity is not positive", async () => {
      await expect(
        service.addStock({ inventoryItemId: "item-1", quantity: 0, unit: "ml", type: "purchase" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws if item not found", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          inventoryItem: { findFirst: jest.fn().mockResolvedValue(null) },
        })
      );

      await expect(
        service.addStock({ inventoryItemId: "nonexistent", quantity: 100, unit: "ml", type: "purchase" })
      ).rejects.toThrow(NotFoundException);
    });

    it("creates movement and updates qtyOnHand in transaction", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      const createdMovement = { id: "mov-1", type: "purchase", quantity: 500 };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockResolvedValue(createdMovement),
          },
          inventoryItem: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.addStock({
        inventoryItemId: "item-1",
        quantity: 500,
        unit: "ml",
        type: "purchase",
        unitCost: 0.3,
      });

      expect(result.movement.id).toBe("mov-1");
      expect(result.newQty).toBe(1500); // 1000 + 500
    });

    it("calculates totalCost correctly", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      let capturedData!: MovementCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockImplementation(({ data }: { data: MovementCreateData }) => {
              capturedData = data;
              return Promise.resolve({ id: "mov-1" });
            }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await service.addStock({
        inventoryItemId: "item-1",
        quantity: 100,
        unit: "ml",
        type: "purchase",
        unitCost: 0.5,
      });

      expect(capturedData.unitCost).toBe(0.5);
      expect(capturedData.totalCost).toBe(50); // 0.5 * 100
    });
  });

  describe("deductStock", () => {
    it("throws if quantity is not positive", async () => {
      await expect(
        service.deductStock({ inventoryItemId: "item-1", quantity: -5, unit: "ml", type: "waste" })
      ).rejects.toThrow(BadRequestException);
    });

    it("deducts stock and creates negative movement", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      let capturedData!: MovementCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockImplementation(({ data }: { data: MovementCreateData }) => {
              capturedData = data;
              return Promise.resolve({ id: "mov-2" });
            }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.deductStock({
        inventoryItemId: "item-1",
        quantity: 300,
        unit: "ml",
        type: "waste",
        reason: "Spilled",
      });

      expect(result.newQty).toBe(700); // 1000 - 300
      expect(capturedData.quantity).toBe(-300); // negative for deduction
      expect(capturedData.reason).toBe("Spilled");
    });

    it("rejects a deduction larger than available stock", async () => {
      const lowItem = { ...mockItem, qtyOnHand: { toNumber: () => 100, toString: () => "100" } };
      prisma.inventoryItem.findFirst.mockResolvedValue(lowItem);

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockResolvedValue({ id: "mov-3" }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      await expect(service.deductStock({
        inventoryItemId: "item-1",
        quantity: 200,
        unit: "ml",
        type: "adjustment_down",
        reason: "Manual correction",
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe("setOpeningStock", () => {
    it("throws if quantity is negative", async () => {
      await expect(
        service.setOpeningStock({ inventoryItemId: "item-1", quantity: -10, unit: "ml" })
      ).rejects.toThrow(BadRequestException);
    });

    it("sets opening stock with initial type", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      let capturedData!: MovementCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockImplementation(({ data }: { data: MovementCreateData }) => {
              capturedData = data;
              return Promise.resolve({ id: "mov-4" });
            }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.setOpeningStock({
        inventoryItemId: "item-1",
        quantity: 2000,
        unit: "ml",
        unitCost: 0.4,
      });

      expect(result.newQty).toBe(2000);
      expect(capturedData.type).toBe("initial");
      expect(capturedData.qtyBefore.toString()).toBe("1000");
    });
  });

  describe("adjustStock", () => {
    it("throws if reason is empty", async () => {
      await expect(
        service.adjustStock({ inventoryItemId: "item-1", newQuantity: 100, reason: "   " })
      ).rejects.toThrow(BadRequestException);
    });

    it("creates adjustment_up when increasing", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      let capturedData!: MovementCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockImplementation(({ data }: { data: MovementCreateData }) => {
              capturedData = data;
              return Promise.resolve({ id: "mov-5" });
            }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.adjustStock({
        inventoryItemId: "item-1",
        newQuantity: 1500,
        reason: "Found extra stock",
      });

      expect(result.newQty).toBe(1500);
      expect(capturedData.type).toBe("adjustment_up");
      expect(capturedData.quantity.toString()).toBe("500"); // 1500 - 1000
    });

    it("creates adjustment_down when decreasing", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      let capturedData!: MovementCreateData;
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: {
            create: jest.fn().mockImplementation(({ data }: { data: MovementCreateData }) => {
              capturedData = data;
              return Promise.resolve({ id: "mov-6" });
            }),
          },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.adjustStock({
        inventoryItemId: "item-1",
        newQuantity: 800,
        reason: "Counted less",
      });

      expect(result.newQty).toBe(800);
      expect(capturedData.type).toBe("adjustment_down");
      expect(capturedData.quantity.toString()).toBe("-200"); // 800 - 1000
    });
  });

  describe("consumeForSale", () => {
    it("returns empty if no recipe lines", async () => {
      prisma.recipeLine.findMany.mockResolvedValue([]);

      const result = await service.consumeForSale({
        menuItemId: "menu-1",
        orderId: "order-1",
        quantity: 1,
      });

      expect(result.consumed).toEqual([]);
    });

    it("is idempotent - does not consume twice", async () => {
      prisma.stockMovement.findFirst.mockResolvedValue({ id: "existing" });

      const result = await service.consumeForSale({
        menuItemId: "menu-1",
        orderId: "order-1",
        quantity: 1,
      });

      expect(result.consumed).toEqual([]);
      expect(prisma.recipeLine.findMany).not.toHaveBeenCalled();
    });

    it("consumes recipe ingredients for a sale", async () => {
      prisma.stockMovement.findFirst.mockResolvedValue(null); // no existing
      prisma.recipeLine.findMany.mockResolvedValue([
        { id: "r1", menuItemId: "menu-1", inventoryItemId: "item-1", quantity: 200, unit: "ml" },
      ]);
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          stockMovement: { create: jest.fn().mockResolvedValue({}) },
          inventoryItem: { update: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.consumeForSale({
        menuItemId: "menu-1",
        orderId: "order-1",
        quantity: 3, // 3 lattes
      });

      expect(result.consumed).toHaveLength(1);
      expect(result.consumed[0].qty).toBe(600); // 200 * 3
    });
  });

  describe("getLowStockAlerts", () => {
    it("returns items with status classification", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        { ...mockItem, qtyOnHand: { toNumber: () => 100, toString: () => "100" } }, // critical (100 <= 200)
        { ...mockItem, id: "item-2", qtyOnHand: { toNumber: () => 0, toString: () => "0" } }, // out of stock
        { ...mockItem, id: "item-3", qtyOnHand: { toNumber: () => 2000, toString: () => "2000" } }, // normal
      ]);

      const result = await service.getLowStockAlerts();
      expect(result).toHaveLength(3);
      expect(result[0].status).toBe("critical");
      expect(result[1].status).toBe("out_of_stock");
      expect(result[2].status).toBe("normal");
    });
  });
});
