import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";

describe("MenuService", () => {
  let service: MenuService;
  let prisma: {
    category: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    menuItem: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock };
  };
  let notifications: { create: jest.Mock; resolveBySource: jest.Mock };
  let gateway: { broadcastMenuAvailability: jest.Mock };

  const mockCategory = { id: "cat-1", nameAr: "مشروبات", nameEn: "Beverages", sortOrder: 1 };
  const mockItem = {
    id: "m1",
    nameAr: "شاورما",
    nameEn: "Shawarma",
    descriptionAr: "",
    descriptionEn: "",
    price: 50,
    image: "img.jpg",
    available: true,
    deletedAt: null,
    categoryId: "cat-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    variants: [],
  };

  beforeEach(async () => {
    prisma = {
      category: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      menuItem: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    };
    notifications = { create: jest.fn(), resolveBySource: jest.fn() };
    gateway = { broadcastMenuAvailability: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: WebsocketGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(MenuService);
  });

  describe("categories", () => {
    it("findAllCategories returns categories ordered by sortOrder", async () => {
      prisma.category.findMany.mockResolvedValue([mockCategory]);
      const result = await service.findAllCategories();
      expect(result).toHaveLength(1);
      expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { sortOrder: "asc" } });
    });

    it("createCategory creates and returns", async () => {
      prisma.category.create.mockResolvedValue(mockCategory);
      const result = await service.createCategory({ nameAr: "مشروبات", nameEn: "Beverages" });
      expect(result.id).toBe("cat-1");
    });

    it("updateCategory updates and returns", async () => {
      prisma.category.update.mockResolvedValue({ ...mockCategory, nameEn: "Drinks" });
      const result = await service.updateCategory("cat-1", { nameEn: "Drinks" });
      expect(result.nameEn).toBe("Drinks");
    });

    it("deleteCategory succeeds when empty", async () => {
      prisma.menuItem.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue(mockCategory);
      const result = await service.deleteCategory("cat-1");
      expect(result.id).toBe("cat-1");
    });

    it("deleteCategory rejects when category has items", async () => {
      prisma.menuItem.count.mockResolvedValue(3);

      await expect(service.deleteCategory("cat-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("menu items", () => {
    it("findAllMenuItems serializes Decimal prices to numbers", async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { ...mockItem, price: { toNumber: () => 50 } },
      ]);
      const result = await service.findAllMenuItems();
      expect(result[0].price).toBe(50);
      expect(typeof result[0].price).toBe("number");
    });

    it("findMenuItem returns null for deleted items", async () => {
      prisma.menuItem.findFirst.mockResolvedValue(null);
      const result = await service.findMenuItem("m1");
      expect(result).toBeNull();
    });

    it("findMenuItem returns serialized item", async () => {
      prisma.menuItem.findFirst.mockResolvedValue(mockItem);
      const result = await service.findMenuItem("m1");
      expect(result?.nameEn).toBe("Shawarma");
    });

    it("createMenuItem creates and returns serialized item", async () => {
      prisma.menuItem.create.mockResolvedValue(mockItem);
      const result = await service.createMenuItem({
        categoryId: "cat-1",
        nameAr: "شاورما",
        nameEn: "Shawarma",
        price: 50,
      });
      expect(result.nameEn).toBe("Shawarma");
    });

    it("updateMenuItem broadcasts when availability changes to false", async () => {
      prisma.menuItem.findFirst.mockResolvedValue({ ...mockItem, available: true });
      prisma.menuItem.update.mockResolvedValue({ ...mockItem, available: false });

      await service.updateMenuItem("m1", { available: false });

      expect(gateway.broadcastMenuAvailability).toHaveBeenCalledWith({
        menuItemId: "m1",
        available: false,
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "menu_out_of_stock", sourceId: "m1" })
      );
    });

    it("updateMenuItem resolves notification when availability changes to true", async () => {
      prisma.menuItem.findFirst.mockResolvedValue({ ...mockItem, available: false });
      prisma.menuItem.update.mockResolvedValue({ ...mockItem, available: true });

      await service.updateMenuItem("m1", { available: true });

      expect(notifications.resolveBySource).toHaveBeenCalledWith("menu", "m1");
    });

    it("updateMenuItem does not broadcast when availability unchanged", async () => {
      prisma.menuItem.findFirst.mockResolvedValue({ ...mockItem, available: true });
      prisma.menuItem.update.mockResolvedValue({ ...mockItem, available: true });

      await service.updateMenuItem("m1", { nameEn: "New Name" });

      expect(gateway.broadcastMenuAvailability).not.toHaveBeenCalled();
    });

    it("rejects a negative price on update", async () => {
      await expect(service.updateMenuItem("m1", { price: -1 })).rejects.toThrow(BadRequestException);
      expect(prisma.menuItem.update).not.toHaveBeenCalled();
    });

    it("deleteMenuItem soft-deletes and broadcasts when item was available", async () => {
      prisma.menuItem.findFirst.mockResolvedValue({ ...mockItem, available: true });
      prisma.menuItem.update.mockResolvedValue({ ...mockItem, deletedAt: new Date(), available: false });

      const result = await service.deleteMenuItem("m1");

      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(gateway.broadcastMenuAvailability).toHaveBeenCalledWith({
        menuItemId: "m1",
        available: false,
      });
      expect(notifications.create).toHaveBeenCalled();
    });

    it("deleteMenuItem does not broadcast when item was already unavailable", async () => {
      prisma.menuItem.findFirst.mockResolvedValue({ ...mockItem, available: false });
      prisma.menuItem.update.mockResolvedValue({ ...mockItem, deletedAt: new Date(), available: false });

      await service.deleteMenuItem("m1");

      expect(gateway.broadcastMenuAvailability).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
