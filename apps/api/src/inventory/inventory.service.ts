import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { cairoDayStart, cairoDayEnd } from "../common/utils/cairo-time";

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ─── Inventory Categories ───

  async findAllCategories() {
    return this.prisma.inventoryCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { items: true } } },
    });
  }

  async findActiveCategories() {
    return this.prisma.inventoryCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createCategory(data: { nameAr: string; nameEn: string; description?: string; sortOrder?: number }) {
    return this.prisma.inventoryCategory.create({ data });
  }

  async updateCategory(
    id: string,
    data: Partial<{ nameAr: string; nameEn: string; description: string; sortOrder: number; active: boolean }>
  ) {
    const cat = await this.prisma.inventoryCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException("Inventory category not found");
    return this.prisma.inventoryCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.inventoryCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException("Inventory category not found");
    const itemCount = await this.prisma.inventoryItem.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category: it still contains ${itemCount} inventory item(s). Delete or move the items first.`
      );
    }
    return this.prisma.inventoryCategory.delete({ where: { id } });
  }

  // ─── Inventory Items ───

  async findAllItems(params?: { categoryId?: string; active?: boolean; search?: string }) {
    const where: Prisma.InventoryItemWhereInput = { deletedAt: null };
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.active !== undefined) where.active = params.active;
    if (params?.search) {
      where.OR = [
        { nameAr: { contains: params.search, mode: "insensitive" } },
        { nameEn: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }
    return this.prisma.inventoryItem.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findItem(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return item;
  }

  async createItem(data: {
    categoryId: string;
    nameAr: string;
    nameEn: string;
    code?: string;
    description?: string;
    unit?: string;
    minQty?: number;
    reorderPoint?: number;
    recommendedReorderQty?: number;
  }) {
    // Validate category exists
    const cat = await this.prisma.inventoryCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat) throw new BadRequestException("Inventory category not found");

    // Check duplicate code if provided
    if (data.code) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: { code: data.code, deletedAt: null },
      });
      if (existing) throw new BadRequestException("An inventory item with this code already exists");
    }

    return this.prisma.inventoryItem.create({
      data,
      include: { category: true },
    });
  }

  async updateItem(
    id: string,
    data: Partial<{
      categoryId: string;
      nameAr: string;
      nameEn: string;
      code: string;
      description: string;
      unit: string;
      minQty: number;
      reorderPoint: number;
      recommendedReorderQty: number;
      active: boolean;
    }>
  ) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException("Inventory item not found");

    if (data.code) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: { code: data.code, deletedAt: null, id: { not: id } },
      });
      if (existing) throw new BadRequestException("An inventory item with this code already exists");
    }

    if (data.categoryId) {
      const cat = await this.prisma.inventoryCategory.findUnique({ where: { id: data.categoryId } });
      if (!cat) throw new BadRequestException("Inventory category not found");
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async deleteItem(id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException("Inventory item not found");
    return this.prisma.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
      include: { category: true },
    });
  }

  // ─── Stock Movements ───

  async getMovements(itemId: string, params?: { take?: number; skip?: number }) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: itemId, deletedAt: null } });
    if (!item) throw new NotFoundException("Inventory item not found");

    const take = Math.min(Math.max(params?.take ?? 50, 1), 500);
    const skip = Math.max(params?.skip ?? 0, 0);

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { inventoryItemId: itemId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      this.prisma.stockMovement.count({ where: { inventoryItemId: itemId } }),
    ]);

    return { movements, total, take, skip };
  }

  async getAllMovements(params?: {
    take?: number;
    skip?: number;
    type?: string;
    from?: string;
    to?: string;
    search?: string;
  }) {
    const take = Math.min(Math.max(params?.take ?? 50, 1), 500);
    const skip = Math.max(params?.skip ?? 0, 0);

    const where: Prisma.StockMovementWhereInput = {};
    if (params?.type) where.type = params.type as StockMovementType;
    if (params?.from || params?.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      const gte = cairoDayStart(params.from);
      const lte = cairoDayEnd(params.to);
      if (gte) createdAt.gte = gte;
      if (lte) createdAt.lte = lte;
      where.createdAt = createdAt;
    }
    if (params?.search) {
      where.inventoryItem = {
        OR: [
          { nameAr: { contains: params.search, mode: "insensitive" } },
          { nameEn: { contains: params.search, mode: "insensitive" } },
          { code: { contains: params.search, mode: "insensitive" } },
        ],
      };
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: { inventoryItem: { select: { nameAr: true, nameEn: true, code: true, unit: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { movements, total, take, skip };
  }

  // ─── Inventory Reports ───

  async getAllItemsReport(params?: { categoryId?: string; search?: string }) {
    const where: Prisma.InventoryItemWhereInput = { deletedAt: null, active: true };
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.search) {
      where.OR = [
        { nameAr: { contains: params.search, mode: "insensitive" } },
        { nameEn: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      include: { category: { select: { nameAr: true, nameEn: true } } },
      orderBy: { nameAr: "asc" },
    });

    const summary = {
      totalItems: items.length,
      totalValue: items.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0),
      inStock: items.filter((i) => Number(i.qtyOnHand) > Number(i.reorderPoint)).length,
      lowStock: items.filter((i) => Number(i.qtyOnHand) > 0 && Number(i.qtyOnHand) <= Number(i.reorderPoint)).length,
      outOfStock: items.filter((i) => Number(i.qtyOnHand) === 0).length,
    };

    return { items, summary };
  }

  async getLowStockReport(params?: { categoryId?: string; search?: string }) {
    const where: Prisma.InventoryItemWhereInput = {
      deletedAt: null,
      active: true,
      qtyOnHand: { gt: 0 },
      reorderPoint: { gt: 0 },
    };
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.search) {
      where.OR = [
        { nameAr: { contains: params.search, mode: "insensitive" } },
        { nameEn: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      include: { category: { select: { nameAr: true, nameEn: true } } },
      orderBy: { qtyOnHand: "asc" },
    });

    const filtered = items.filter((i) => Number(i.qtyOnHand) <= Number(i.reorderPoint));
    const summary = {
      totalItems: filtered.length,
      totalValue: filtered.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0),
      criticalCount: filtered.filter((i) => Number(i.qtyOnHand) <= Number(i.minQty)).length,
    };

    return { items: filtered, summary };
  }

  async getOutOfStockReport(params?: { categoryId?: string; search?: string }) {
    const where: Prisma.InventoryItemWhereInput = { deletedAt: null, active: true, qtyOnHand: { equals: 0 } };
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.search) {
      where.OR = [
        { nameAr: { contains: params.search, mode: "insensitive" } },
        { nameEn: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      include: { category: { select: { nameAr: true, nameEn: true } } },
      orderBy: { nameAr: "asc" },
    });

    return { items, summary: { totalItems: items.length } };
  }

  async getInventorySummaryReport() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { deletedAt: null, active: true },
      include: { category: { select: { nameAr: true, nameEn: true } } },
      orderBy: { nameAr: "asc" },
    });

    const inStock = items.filter((i) => Number(i.qtyOnHand) > Number(i.reorderPoint));
    const lowStock = items.filter((i) => Number(i.qtyOnHand) > 0 && Number(i.qtyOnHand) <= Number(i.reorderPoint));
    const outOfStock = items.filter((i) => Number(i.qtyOnHand) === 0);

    return {
      items,
      summary: {
        totalItems: items.length,
        totalValue: items.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0),
        inStockCount: inStock.length,
        inStockValue: inStock.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0),
        lowStockCount: lowStock.length,
        lowStockValue: lowStock.reduce((sum, i) => sum + Number(i.qtyOnHand) * Number(i.avgUnitCost), 0),
        outOfStockCount: outOfStock.length,
      },
    };
  }

  // ─── Dashboard ───

  async getDashboard() {
    const [
      totalItems,
      lowStockItems,
      criticalStockItems,
      outOfStockItems,
      recentMovements,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { deletedAt: null, active: true } }),
      this.prisma.inventoryItem.findMany({
        where: {
          deletedAt: null,
          active: true,
          qtyOnHand: { gt: 0 },
          reorderPoint: { gt: 0 },
        },
        select: { id: true, nameAr: true, nameEn: true, qtyOnHand: true, reorderPoint: true, unit: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          deletedAt: null,
          active: true,
          qtyOnHand: { gt: 0 },
          minQty: { gt: 0 },
        },
        select: { id: true, nameAr: true, nameEn: true, qtyOnHand: true, minQty: true, unit: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { deletedAt: null, active: true, qtyOnHand: { equals: 0 } },
        select: { id: true, nameAr: true, nameEn: true, unit: true },
      }),
      this.prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { inventoryItem: { select: { nameAr: true, nameEn: true } } },
      }),
    ]);

    // Filter low stock: qtyOnHand <= reorderPoint
    const lowStock = lowStockItems.filter(
      (i) => Number(i.qtyOnHand) <= Number(i.reorderPoint) && Number(i.qtyOnHand) > 0
    );
    // Filter critical: qtyOnHand <= minQty
    const critical = criticalStockItems.filter(
      (i) => Number(i.qtyOnHand) <= Number(i.minQty) && Number(i.qtyOnHand) > 0
    );

    // Total inventory value
    const valueResult = await this.prisma.inventoryItem.aggregate({
      where: { deletedAt: null, active: true },
      _sum: { qtyOnHand: true, avgUnitCost: true },
    });

    const totalValue: { totalValue: number | bigint }[] =
      Number(valueResult._sum.avgUnitCost || 0) > 0
        ? await this.prisma.$queryRawUnsafe(
            'SELECT COALESCE(SUM("qtyOnHand" * "avgUnitCost"), 0) as "totalValue" FROM "InventoryItem" WHERE "deletedAt" IS NULL AND "active" = true'
          )
        : [{ totalValue: 0 }];

    return {
      totalItems,
      lowStockCount: lowStock.length,
      criticalStockCount: critical.length,
      outOfStockCount: outOfStockItems.length,
      lowStock,
      criticalStock: critical,
      outOfStock: outOfStockItems,
      recentMovements,
      totalInventoryValue: Number(totalValue[0]?.totalValue || 0),
    };
  }
}
