import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";

describe("InventoryService", () => {
  let service: InventoryService;
  let prisma: {
    inventoryCategory: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    inventoryItem: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
    stockMovement: { findMany: jest.Mock; count: jest.Mock };
    $queryRawUnsafe: jest.Mock;
  };

  const mockCategory = {
    id: "cat-1",
    nameAr: "dag",
    nameEn: "Dairy",
    description: "",
    active: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockItem = {
    id: "item-1",
    categoryId: "cat-1",
    nameAr: "lb",
    nameEn: "Milk",
    code: "MILK-001",
    description: "",
    unit: "ml",
    qtyOnHand: { toNumber: () => 1000, toString: () => "1000" },
    minQty: { toNumber: () => 200, toString: () => "200" },
    reorderPoint: { toNumber: () => 500, toString: () => "500" },
    recommendedReorderQty: { toNumber: () => 1000, toString: () => "1000" },
    avgUnitCost: { toNumber: () => 0.5, toString: () => "0.5" },
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: mockCategory,
  };

  beforeEach(async () => {
    prisma = {
      inventoryCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ totalValue: 500 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe("Categories", () => {
    it("findAllCategories returns categories with item counts", async () => {
      prisma.inventoryCategory.findMany.mockResolvedValue([
        { ...mockCategory, _count: { items: 5 } },
      ]);

      const result = await service.findAllCategories();
      expect(result).toHaveLength(1);
      expect(result[0]._count.items).toBe(5);
    });

    it("createCategory creates a new category", async () => {
      prisma.inventoryCategory.create.mockResolvedValue(mockCategory);

      const result = await service.createCategory({ nameAr: "dag", nameEn: "Dairy" });
      expect(result.nameEn).toBe("Dairy");
      expect(prisma.inventoryCategory.create).toHaveBeenCalled();
    });

    it("updateCategory throws NotFoundException for non-existent category", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(null);

      await expect(service.updateCategory("nonexistent", { nameEn: "New" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("updateCategory updates existing category", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.inventoryCategory.update.mockResolvedValue({ ...mockCategory, nameEn: "Updated" });

      const result = await service.updateCategory("cat-1", { nameEn: "Updated" });
      expect(result.nameEn).toBe("Updated");
    });

    it("deleteCategory throws if items exist", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.inventoryItem.count.mockResolvedValue(3);

      await expect(service.deleteCategory("cat-1")).rejects.toThrow(BadRequestException);
    });

    it("deleteCategory succeeds when no items", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.inventoryItem.count.mockResolvedValue(0);
      prisma.inventoryCategory.delete.mockResolvedValue(mockCategory);

      const result = await service.deleteCategory("cat-1");
      expect(result.id).toBe("cat-1");
    });
  });

  describe("Items", () => {
    it("findAllItems returns items with category", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([mockItem]);

      const result = await service.findAllItems();
      expect(result).toHaveLength(1);
      expect(result[0].category).toBeDefined();
    });

    it("findAllItems filters by categoryId", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([mockItem]);

      await service.findAllItems({ categoryId: "cat-1" });
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: "cat-1" }),
        })
      );
    });

    it("findAllItems filters by search term", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([mockItem]);

      await service.findAllItems({ search: "milk" });
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ nameEn: expect.objectContaining({ contains: "milk" }) }),
            ]),
          }),
        })
      );
    });

    it("findItem throws NotFoundException for non-existent item", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.findItem("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("findItem returns item when found", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);

      const result = await service.findItem("item-1");
      expect(result.id).toBe("item-1");
    });

    it("createItem validates category exists", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.createItem({ categoryId: "bad", nameAr: "tst", nameEn: "Test" })
      ).rejects.toThrow(BadRequestException);
    });

    it("createItem checks duplicate code", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem); // existing with same code

      await expect(
        service.createItem({ categoryId: "cat-1", nameAr: "tst", nameEn: "Test", code: "MILK-001" })
      ).rejects.toThrow(BadRequestException);
    });

    it("createItem succeeds with valid data", async () => {
      prisma.inventoryCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.inventoryItem.findFirst.mockResolvedValue(null); // no duplicate
      prisma.inventoryItem.create.mockResolvedValue(mockItem);

      const result = await service.createItem({
        categoryId: "cat-1",
        nameAr: "lb",
        nameEn: "Milk",
        code: "MILK-001",
      });
      expect(result.id).toBe("item-1");
    });

    it("updateItem throws NotFoundException for non-existent item", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.updateItem("nonexistent", { nameEn: "New" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("deleteItem soft-deletes the item", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);
      prisma.inventoryItem.update.mockResolvedValue({ ...mockItem, deletedAt: new Date() });

      const result = await service.deleteItem("item-1");
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe("Movements", () => {
    it("getMovements throws for non-existent item", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.getMovements("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("getMovements returns paginated movements", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      const result = await service.getMovements("item-1", { take: 10, skip: 0 });
      expect(result.movements).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("getMovements clamps take to max 500", async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(mockItem);
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.stockMovement.count.mockResolvedValue(0);

      await service.getMovements("item-1", { take: 9999 });
      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 })
      );
    });
  });

  describe("Dashboard", () => {
    it("returns dashboard data with counts", async () => {
      prisma.inventoryItem.count.mockResolvedValue(10);
      prisma.inventoryItem.findMany
        .mockResolvedValueOnce([]) // low stock
        .mockResolvedValueOnce([]) // critical
        .mockResolvedValueOnce([]); // out of stock
      prisma.stockMovement.findMany.mockResolvedValue([]);
      prisma.inventoryItem.aggregate.mockResolvedValue({
        _sum: { qtyOnHand: null, avgUnitCost: null },
      });

      const result = await service.getDashboard();
      expect(result.totalItems).toBe(10);
      expect(result.lowStockCount).toBe(0);
      expect(result.outOfStockCount).toBe(0);
    });
  });
});
