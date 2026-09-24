import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";

@Injectable()
export class TablesService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway
  ) {}

  async findAll() {
    const tables = await this.prisma.table.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, status: true, createdAt: true, customerName: true },
        },
      },
    });

    // Compute occupancy status from active orders
    return tables.map((table) => ({
      id: table.id,
      number: table.number,
      label: table.label,
      capacity: table.capacity,
      active: table.active,
      occupied: table.orders.length > 0,
      activeOrders: table.orders.length,
      orders: table.orders,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    }));
  }

  async findById(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, status: true, createdAt: true, customerName: true },
        },
      },
    });

    if (!table) throw new NotFoundException("Table not found");

    return {
      ...table,
      occupied: table.orders.length > 0,
      activeOrders: table.orders.length,
    };
  }

  async findByNumber(number: number) {
    const table = await this.prisma.table.findUnique({
      where: { number },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, status: true, createdAt: true, customerName: true },
        },
      },
    });

    if (!table) throw new NotFoundException("Table not found");

    return {
      ...table,
      occupied: table.orders.length > 0,
      activeOrders: table.orders.length,
    };
  }

  async create(data: { number: number; label?: string; capacity?: number }) {
    // Validate number is within configured range
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { id: "main" },
      select: { totalTables: true, tableNumberStart: true, tableNumberEnd: true },
    });

    if (settings && settings.totalTables > 0) {
      if (data.number < settings.tableNumberStart || data.number > settings.tableNumberEnd) {
        throw new BadRequestException(
          `Table number must be between ${settings.tableNumberStart} and ${settings.tableNumberEnd}`
        );
      }
    }

    // Check for duplicate number
    const existing = await this.prisma.table.findUnique({
      where: { number: data.number },
    });
    if (existing) {
      throw new ConflictException(`Table number ${data.number} already exists`);
    }

    const table = await this.prisma.table.create({
      data: {
        number: data.number,
        label: data.label || null,
        capacity: data.capacity || 4,
      },
    });

    this.wsGateway.broadcastTableUpdate?.(table);
    return table;
  }

  async update(id: string, data: { label?: string; capacity?: number; active?: boolean }) {
    const table = await this.prisma.table.findUnique({ where: { id } });
    if (!table) throw new NotFoundException("Table not found");

    const updated = await this.prisma.table.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    this.wsGateway.broadcastTableUpdate?.(updated);
    return updated;
  }

  async delete(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
          },
        },
      },
    });

    if (!table) throw new NotFoundException("Table not found");

    if (table.orders.length > 0) {
      throw new BadRequestException("Cannot delete table with active orders");
    }

    // Soft delete - just mark as inactive
    const updated = await this.prisma.table.update({
      where: { id },
      data: { active: false },
    });

    this.wsGateway.broadcastTableUpdate?.(updated);
    return { success: true };
  }

  /**
   * Seed tables based on restaurant settings (totalTables, start, end).
   * Creates missing tables and deactivates tables outside the new range.
   */
  async seedFromSettings() {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { id: "main" },
      select: { totalTables: true, tableNumberStart: true, tableNumberEnd: true },
    });

    if (!settings || settings.totalTables === 0) {
      return { created: 0, deactivated: 0 };
    }

    const start = settings.tableNumberStart;
    const end = settings.tableNumberEnd;

    // Create missing tables
    const existingTables = await this.prisma.table.findMany({
      where: { number: { gte: start, lte: end } },
      select: { number: true },
    });
    const existingNumbers = new Set(existingTables.map((t) => t.number));

    const toCreate: { number: number }[] = [];
    for (let i = start; i <= end; i++) {
      if (!existingNumbers.has(i)) {
        toCreate.push({ number: i });
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.table.createMany({ data: toCreate });
    }

    // Deactivate tables outside the range
    const deactivated = await this.prisma.table.updateMany({
      where: {
        number: { lt: start },
        active: true,
      },
      data: { active: false },
    });

    // Also deactivate tables above the range
    await this.prisma.table.updateMany({
      where: {
        number: { gt: end },
        active: true,
      },
      data: { active: false },
    });

    return { created: toCreate.length, deactivated: deactivated.count };
  }

  /**
   * Merge orders: link orders from different tables into a merged group.
   * BE-019: group create + order linking run in one transaction so a partial
   * failure cannot leave orphan groups or half-linked orders.
   */
  async mergeOrders(data: { orderIds: string[]; label?: string }) {
    if (data.orderIds.length < 2) {
      throw new BadRequestException("At least 2 orders are required to merge");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { id: { in: data.orderIds } },
      });

      if (orders.length !== data.orderIds.length) {
        throw new BadRequestException("One or more orders not found");
      }

      const invalidOrder = orders.find(
        (o) => o.status === "cancelled" || o.status === "completed" || o.paymentStatus === "paid"
      );
      if (invalidOrder) {
        throw new BadRequestException("Cannot merge cancelled, completed, or paid orders");
      }

      const tableIds = [...new Set(orders.filter((o) => o.tableId).map((o) => o.tableId!))];
      const tableNumbers = [...new Set(orders.filter((o) => o.tableNumber).map((o) => o.tableNumber!))];

      const mergedGroup = await tx.mergedGroup.create({
        data: {
          label: data.label || `Tables ${tableNumbers.sort((a, b) => a - b).join("+")}`,
          tableIds,
        },
      });

      const link = await tx.order.updateMany({
        where: { id: { in: data.orderIds } },
        data: { mergedGroupId: mergedGroup.id },
      });
      if (link.count !== data.orderIds.length) {
        throw new ConflictException("Merge partially applied — rolled back, retry");
      }

      return tx.mergedGroup.findUnique({
        where: { id: mergedGroup.id },
        include: {
          orders: {
            select: { id: true, orderNumber: true, tableNumber: true, customerName: true, total: true },
          },
        },
      });
    });

    this.wsGateway.broadcastTableUpdate?.({ type: "merge", mergedGroup: updated });
    return updated;
  }

  /**
   * Unmerge orders: remove the merged group and unlink all its orders.
   * BE-019: unlink + delete in one transaction.
   */
  async unmergeOrders(mergedGroupId: string) {
    await this.prisma.$transaction(async (tx) => {
      const group = await tx.mergedGroup.findUnique({
        where: { id: mergedGroupId },
      });

      if (!group) throw new NotFoundException("Merged group not found");

      await tx.order.updateMany({
        where: { mergedGroupId },
        data: { mergedGroupId: null },
      });

      await tx.mergedGroup.delete({ where: { id: mergedGroupId } });
    });

    this.wsGateway.broadcastTableUpdate?.({ type: "unmerge", mergedGroupId });
    return { success: true };
  }

  /**
   * Get merged groups with their orders.
   */
  async getMergedGroups() {
    const groups = await this.prisma.mergedGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, orderNumber: true, tableNumber: true, customerName: true, total: true, status: true },
        },
      },
    });

    return groups;
  }

  /**
   * Get table occupancy report.
   */
  async getOccupancyReport() {
    const tables = await this.prisma.table.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, createdAt: true, status: true },
        },
      },
    });

    const totalTables = tables.length;
    const occupiedTables = tables.filter((t) => t.orders.length > 0).length;
    const availableTables = totalTables - occupiedTables;

    const tableDetails = tables.map((table) => {
      const oldestOrder = table.orders.length > 0
        ? table.orders.reduce((oldest, order) =>
            new Date(order.createdAt) < new Date(oldest.createdAt) ? order : oldest
          )
        : null;

      return {
        id: table.id,
        number: table.number,
        label: table.label,
        capacity: table.capacity,
        occupied: table.orders.length > 0,
        activeOrders: table.orders.length,
        oldestOrderAt: oldestOrder?.createdAt || null,
      };
    });

    return {
      totalTables,
      occupiedTables,
      availableTables,
      occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
      tables: tableDetails,
    };
  }

  /**
   * Get stale tables - tables that have been occupied for too long.
   */
  async getStaleTables() {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { id: "main" },
      select: { staleThresholdMinutes: true },
    });

    const thresholdMinutes = settings?.staleThresholdMinutes ?? 30;
    const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const tables = await this.prisma.table.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: {
            status: { notIn: ["cancelled", "completed"] },
            paymentStatus: { not: "paid" },
          },
          select: { id: true, createdAt: true, status: true, customerName: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const staleTables = tables
      .filter((table) => table.orders.length > 0)
      .filter((table) => {
        const oldestOrder = table.orders.reduce((oldest, order) =>
          new Date(order.createdAt) < new Date(oldest.createdAt) ? order : oldest
        );
        return new Date(oldestOrder.createdAt) < thresholdDate;
      })
      .map((table) => {
        const oldestOrder = table.orders.reduce((oldest, order) =>
          new Date(order.createdAt) < new Date(oldest.createdAt) ? order : oldest
        );
        const elapsedMinutes = Math.round(
          (Date.now() - new Date(oldestOrder.createdAt).getTime()) / 60000
        );

        return {
          id: table.id,
          number: table.number,
          label: table.label,
          capacity: table.capacity,
          activeOrders: table.orders.length,
          oldestOrderAt: oldestOrder.createdAt,
          elapsedMinutes,
          thresholdMinutes,
        };
      });

    return staleTables;
  }
}
