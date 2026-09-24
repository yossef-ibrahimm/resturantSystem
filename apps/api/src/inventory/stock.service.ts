import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, StockMovement, StockMovementType, InventoryItem } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async lockItem(tx: Prisma.TransactionClient, inventoryItemId: string): Promise<InventoryItem | null> {
    if (typeof tx.$queryRaw === "function") {
      const rows = await tx.$queryRaw<InventoryItem[]>`
        SELECT * FROM "InventoryItem"
        WHERE "id" = ${inventoryItemId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      return rows[0] || null;
    }
    const findItem = tx.inventoryItem?.findFirst || this.prisma.inventoryItem.findFirst.bind(this.prisma.inventoryItem);
    return findItem({
      where: { id: inventoryItemId, deletedAt: null },
    });
  }

  private toDecimal(value: unknown): Prisma.Decimal {
    if (value && typeof value === "object" && typeof (value as { toNumber?: unknown }).toNumber === "function") {
      return new Prisma.Decimal((value as { toNumber: () => number }).toNumber());
    }
    return new Prisma.Decimal(value as Prisma.Decimal.Value);
  }

  private async checkAndNotifyStockLevel(inventoryItemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, deletedAt: null, active: true },
    });
    if (!item) return;

    const qty = Number(item.qtyOnHand);
    const reorder = Number(item.reorderPoint);
    const min = Number(item.minQty);

    if (qty === 0) {
      await this.notificationsService.create({
        type: "inventory_out_of_stock",
        titleAr: `نفاد المخزون: ${item.nameAr}`,
        titleEn: `Out of Stock: ${item.nameEn}`,
        messageAr: `العنصر «${item.nameAr}» نفد من المخزون (0 ${item.unit})`,
        messageEn: `Item "${item.nameEn}" is out of stock (0 ${item.unit})`,
        sourceType: "inventory",
        sourceId: inventoryItemId,
      });
    } else if (qty <= min) {
      await this.notificationsService.create({
        type: "inventory_low_stock",
        titleAr: `مخزون حرج: ${item.nameAr}`,
        titleEn: `Critical Stock: ${item.nameEn}`,
        messageAr: `العنصر «${item.nameAr}» وصل إلى الحد الأدنى (${qty} ${item.unit})`,
        messageEn: `Item "${item.nameEn}" reached minimum threshold (${qty} ${item.unit})`,
        sourceType: "inventory",
        sourceId: inventoryItemId,
      });
    } else if (qty <= reorder) {
      await this.notificationsService.create({
        type: "inventory_low_stock",
        titleAr: `مخزون منخفض: ${item.nameAr}`,
        titleEn: `Low Stock: ${item.nameEn}`,
        messageAr: `العنصر «${item.nameAr}» مخزونه منخفض (${qty} ${item.unit})`,
        messageEn: `Item "${item.nameEn}" stock is low (${qty} ${item.unit})`,
        sourceType: "inventory",
        sourceId: inventoryItemId,
      });
    }
  }

  async setOpeningStock(params: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    unitCost?: number;
    actorId?: string;
  }): Promise<{ movement: StockMovement; newQty: number }> {
    const { inventoryItemId, quantity, unit, unitCost, actorId } = params;
    if (quantity < 0) throw new BadRequestException("Opening quantity cannot be negative");

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, inventoryItemId);
      if (!item) throw new NotFoundException("Inventory item not found");
      const qtyBefore = this.toDecimal(item.qtyOnHand);
      const qtyAfter = new Prisma.Decimal(quantity);
      const movement = await tx.stockMovement.create({
        data: {
          inventoryItemId,
          type: "initial",
          quantity: qtyAfter.sub(qtyBefore),
          unit,
          qtyBefore,
          qtyAfter,
          unitCost: unitCost || null,
          totalCost: unitCost ? unitCost * quantity : null,
          refType: "opening",
          actorId: actorId || null,
        },
      });
      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          qtyOnHand: qtyAfter,
          ...(unitCost != null ? { avgUnitCost: new Prisma.Decimal(unitCost).toDecimalPlaces(4) } : {}),
        },
      });
      await tx.auditLog?.create?.({
        data: {
          action: "inventory.stock_opening",
          entityType: "InventoryItem",
          entityId: inventoryItemId,
          userId: actorId || null,
          beforeJson: { qtyOnHand: qtyBefore.toNumber() },
          afterJson: { qtyOnHand: qtyAfter.toNumber(), movementId: movement.id },
        },
      });
      return { movement, qtyAfter };
    });

    await this.checkAndNotifyStockLevel(inventoryItemId);
    return { movement: result.movement, newQty: result.qtyAfter.toNumber() };
  }

  /**
   * Add stock to an inventory item.
   * Creates a StockMovement and updates qtyOnHand atomically.
   */
  async addStock(params: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    type: StockMovementType;
    refType?: string;
    refId?: string;
    unitCost?: number;
    reason?: string;
    note?: string;
    actorId?: string;
  }): Promise<{ movement: StockMovement; newQty: number }> {
    const { inventoryItemId, quantity, unit, type, refType, refId, unitCost, reason, note, actorId } = params;

    if (quantity <= 0) throw new BadRequestException("Quantity must be positive for stock addition");

    const totalCost = unitCost ? unitCost * quantity : null;

    // Weighted-average unit cost calculation
    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, inventoryItemId);
      if (!item) throw new NotFoundException("Inventory item not found");

      const qtyBefore = this.toDecimal(item.qtyOnHand);
      const qtyAfter = qtyBefore.add(quantity);
      let newAvgUnitCost: Prisma.Decimal | undefined;
      if (unitCost != null && unitCost > 0) {
        const oldAvgCost = this.toDecimal(item.avgUnitCost);
        newAvgUnitCost = qtyBefore.eq(0)
          ? new Prisma.Decimal(unitCost)
          : qtyBefore.mul(oldAvgCost).add(new Prisma.Decimal(quantity).mul(unitCost)).div(qtyAfter).toDecimalPlaces(4);
      }
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId,
          type,
          quantity,
          unit,
          qtyBefore,
          qtyAfter,
          refType: refType || null,
          refId: refId || null,
          unitCost: unitCost || null,
          totalCost: totalCost || null,
          reason: reason || null,
          note: note || null,
          actorId: actorId || null,
        },
      });

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          qtyOnHand: qtyAfter,
          ...(newAvgUnitCost ? { avgUnitCost: newAvgUnitCost } : {}),
        },
      });

      await tx.auditLog?.create?.({
        data: {
          action: "inventory.stock_add",
          entityType: "InventoryItem",
          entityId: inventoryItemId,
          userId: actorId || null,
          beforeJson: { qtyOnHand: qtyBefore.toNumber() },
          afterJson: { qtyOnHand: qtyAfter.toNumber(), movementId: mov.id },
          note: reason || note || null,
        },
      });

      return { mov, qtyAfter };
    });

    await this.checkAndNotifyStockLevel(inventoryItemId);
    return { movement: movement.mov, newQty: movement.qtyAfter.toNumber() };
  }

  /**
   * Deduct stock from an inventory item.
   * Creates a StockMovement and updates qtyOnHand atomically.
   * Allows negative stock per A14 but logs it.
   */
  async deductStock(params: {
    inventoryItemId: string;
    quantity: number;
    unit: string;
    type: StockMovementType;
    refType?: string;
    refId?: string;
    unitCost?: number;
    reason?: string;
    note?: string;
    actorId?: string;
  }): Promise<{ movement: StockMovement; newQty: number }> {
    const { inventoryItemId, quantity, unit, type, refType, refId, unitCost, reason, note, actorId } = params;

    if (quantity <= 0) throw new BadRequestException("Quantity must be positive for stock deduction");

    const totalCost = unitCost ? unitCost * quantity : null;

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, inventoryItemId);
      if (!item) throw new NotFoundException("Inventory item not found");
      const qtyBefore = this.toDecimal(item.qtyOnHand);
      if (qtyBefore.lt(quantity)) {
        throw new BadRequestException("Deduct quantity exceeds available stock");
      }
      const qtyAfter = qtyBefore.sub(quantity);
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId,
          type,
          quantity: -quantity, // negative for deductions
          unit,
          qtyBefore,
          qtyAfter,
          refType: refType || null,
          refId: refId || null,
          unitCost: unitCost || null,
          totalCost: totalCost || null,
          reason: reason || null,
          note: note || null,
          actorId: actorId || null,
        },
      });

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { qtyOnHand: qtyAfter },
      });

      await tx.auditLog?.create?.({
        data: {
          action: "inventory.stock_deduct",
          entityType: "InventoryItem",
          entityId: inventoryItemId,
          userId: actorId || null,
          beforeJson: { qtyOnHand: qtyBefore.toNumber() },
          afterJson: { qtyOnHand: qtyAfter.toNumber(), movementId: mov.id },
          note: reason || note || null,
        },
      });

      return { mov, qtyAfter };
    });

    await this.checkAndNotifyStockLevel(inventoryItemId);
    return { movement: movement.mov, newQty: movement.qtyAfter.toNumber() };
  }

  /**
   * Adjust stock for an inventory item (increase or decrease).
   * Creates an adjustment movement and updates qtyOnHand.
   */
  async adjustStock(params: {
    inventoryItemId: string;
    newQuantity: number;
    reason: string;
    note?: string;
    actorId?: string;
  }): Promise<{ movement: StockMovement; newQty: number }> {
    const { inventoryItemId, newQuantity, reason, note, actorId } = params;

    if (newQuantity < 0) throw new BadRequestException("Adjusted quantity cannot be negative");
    if (!reason?.trim()) throw new BadRequestException("Reason is required for stock adjustment");

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, inventoryItemId);
      if (!item) throw new NotFoundException("Inventory item not found");
      const qtyBefore = this.toDecimal(item.qtyOnHand);
      const targetQuantity = new Prisma.Decimal(newQuantity);
      const diff = targetQuantity.sub(qtyBefore);
      const type: StockMovementType = diff.gte(0) ? "adjustment_up" : "adjustment_down";
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId,
          type,
          quantity: diff,
          unit: item.unit,
          qtyBefore,
          qtyAfter: targetQuantity,
          refType: "adjustment",
          refId: null,
          unitCost: null,
          totalCost: null,
          reason,
          note: note || null,
          actorId: actorId || null,
        },
      });

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { qtyOnHand: new Prisma.Decimal(newQuantity) },
      });

      await tx.auditLog?.create?.({
        data: {
          action: "inventory.stock_adjust",
          entityType: "InventoryItem",
          entityId: inventoryItemId,
          userId: actorId || null,
          beforeJson: { qtyOnHand: qtyBefore.toNumber() },
          afterJson: { qtyOnHand: targetQuantity.toNumber(), movementId: mov.id },
          note: reason,
        },
      });

      return { mov, qtyAfter: targetQuantity };
    });

    await this.checkAndNotifyStockLevel(inventoryItemId);
    return { movement: movement.mov, newQty: movement.qtyAfter.toNumber() };
  }

  /**
   * Consume stock for a sale (recipe-based or unit-based).
   * Called when an order is completed.
   * Uses idempotency: checks for existing movement with same refType+refId.
   */
  async consumeForSale(params: {
    menuItemId: string;
    orderId: string;
    quantity: number;
    actorId?: string;
  }): Promise<{ consumed: { itemId: string; qty: number }[] }> {
    const { menuItemId, orderId, quantity, actorId } = params;

    // Idempotency: check if already consumed for this order + menu item combination
    // We check by refId (orderId) since consumeForSale is called per menu item
    const existing = await this.prisma.stockMovement.findFirst({
      where: { refType: "order", refId: orderId, note: menuItemId },
    });
    if (existing) return { consumed: [] };

    // Get recipe lines for this menu item
    const recipeLines = await this.prisma.recipeLine.findMany({
      where: { menuItemId },
    });

    if (recipeLines.length === 0) return { consumed: [] };

    const consumed: { itemId: string; qty: number }[] = [];

    // Single transaction: all stock deductions succeed or fail together
    await this.prisma.$transaction(async (tx) => {
      for (const line of recipeLines) {
        const consumeQty = Number(line.quantity) * quantity;
        if (consumeQty <= 0) continue;

        const item = await this.lockItem(tx, line.inventoryItemId);
        if (!item) continue;

        const qtyBefore = item.qtyOnHand;
        const qtyAfter = new Prisma.Decimal(Number(qtyBefore) - consumeQty);

        await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            type: "sale",
            quantity: -consumeQty,
            unit: line.unit,
            qtyBefore,
            qtyAfter,
            refType: "order",
            refId: orderId,
            unitCost: Number(item.avgUnitCost),
            totalCost: Number(item.avgUnitCost) * consumeQty,
            reason: `Sale consumption for order`,
            note: menuItemId,
            actorId: actorId || null,
          },
        });

        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { qtyOnHand: qtyAfter },
        });

        consumed.push({ itemId: line.inventoryItemId, qty: consumeQty });
      }
    });

    for (const c of consumed) {
      await this.checkAndNotifyStockLevel(c.itemId);
    }

    return { consumed };
  }

  /**
   * Get low stock alerts.
   */
  async getLowStockAlerts() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { deletedAt: null, active: true },
      include: { category: { select: { nameAr: true, nameEn: true } } },
    });

    return items.map((item) => {
      const qty = Number(item.qtyOnHand);
      const reorder = Number(item.reorderPoint);
      const min = Number(item.minQty);

      let status: "normal" | "low" | "critical" | "out_of_stock" = "normal";
      if (qty === 0) status = "out_of_stock";
      else if (qty <= min) status = "critical";
      else if (qty <= reorder) status = "low";

      return { ...item, qtyOnHand: qty, reorderPoint: reorder, minQty: min, status };
    });
  }
}
