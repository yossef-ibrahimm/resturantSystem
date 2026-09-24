import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { CAIRO_TZ, cairoStartOfDayUtc, cairoWeekStartKey } from "../common/utils/cairo-time";

function parseRangeDate(val: string | undefined, mode: "start" | "end", fallback: Date): Date {
  if (!val) return fallback;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return mode === "start"
      ? fromZonedTime(`${trimmed}T00:00:00`, CAIRO_TZ)
      : fromZonedTime(`${trimmed}T23:59:59.999`, CAIRO_TZ);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

function getRange(from?: string, to?: string) {
  const now = new Date();
  const end = parseRangeDate(to, "end", now);
  const start = parseRangeDate(from, "start", cairoStartOfDayUtc(now));
  return { start, end };
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const ms = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - ms), end: new Date(start.getTime() - 1) };
}

const REPORT_ORDER_INCLUDE = { items: true, payments: true } satisfies Prisma.OrderInclude;
type ReportOrder = Prisma.OrderGetPayload<{ include: typeof REPORT_ORDER_INCLUDE }>;

function decimal(v: unknown): Prisma.Decimal {
  return v === null || v === undefined ? new Prisma.Decimal(0) : new Prisma.Decimal(v as Prisma.Decimal.Value);
}

function money(v: Prisma.Decimal): number {
  return v.toDecimalPlaces(2).toNumber();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function numberValue(v: unknown): number {
  return decimal(v).toNumber();
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * PERF-001: summary aggregates in SQL — no findMany of full order sets.
   * Revenue = sum(total) of paid non-cancelled orders; other money metrics
   * sum the same filtered set; refunds/cash come from Payment rows.
   */
  async getSummary(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const prev = getPreviousRange(start, end);
    const notCancelled = { status: { not: "cancelled" as const } };

    const rangeWhere = (s: Date, e: Date) => ({
      createdAt: { gte: s, lte: e },
      ...notCancelled,
    });

    const summarize = async (s: Date, e: Date) => {
      const where = rangeWhere(s, e);
      const [counts, sums, typeCounts, paidSums, paymentSums] = await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.aggregate({
          where,
          _sum: {
            itemsTotal: true,
            discountAmount: true,
            taxAmount: true,
            serviceAmount: true,
            total: true,
          },
        }),
        this.prisma.order.groupBy({
          by: ["orderType"],
          where,
          _count: { _all: true },
        }),
        this.prisma.order.aggregate({
          where: { ...where, paymentStatus: "paid" },
          _sum: { total: true },
          _count: { _all: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            order: where,
            // refunds = negative payment amounts (any method)
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        }),
      ]);

      const cashAgg = await this.prisma.payment.aggregate({
        where: { order: where, method: "cash" },
        _sum: { amount: true },
      });

      const byType = new Map(typeCounts.map((t) => [t.orderType, t._count._all]));
      const revenue = decimal(paidSums._sum.total);
      const paidCount = paidSums._count._all;
      // refunds stored as negative — report absolute outflow
      const refunds = decimal(paymentSums._sum.amount).abs();

      return {
        orderCount: counts,
        paidCount,
        revenue,
        avgValue: paidCount > 0 ? revenue.div(paidCount) : new Prisma.Decimal(0),
        grossSales: decimal(sums._sum.itemsTotal),
        discounts: decimal(sums._sum.discountAmount),
        tax: decimal(sums._sum.taxAmount),
        serviceCharge: decimal(sums._sum.serviceAmount),
        netSales: decimal(sums._sum.total),
        refunds,
        // collected cash = cash payments net of cash refunds (negatives already in sum)
        collectedCash: decimal(cashAgg._sum.amount),
        dineIn: byType.get("dine_in") ?? 0,
        takeaway: byType.get("takeaway") ?? 0,
      };
    };

    const [current, previous] = await Promise.all([
      summarize(start, end),
      summarize(prev.start, prev.end),
    ]);

    const pctChange = (curr: number, prevVal: number): number | null => {
      if (prevVal === 0) return curr > 0 ? 100 : null;
      return round2(((curr - prevVal) / prevVal) * 100);
    };

    const revenue = money(current.revenue);
    const prevRevenue = money(previous.revenue);
    const avgValue = money(current.avgValue);
    const prevAvgValue = money(previous.avgValue);

    return {
      revenue,
      revenueChange: pctChange(revenue, prevRevenue),
      orderCount: current.orderCount,
      orderCountChange: pctChange(current.orderCount, previous.orderCount),
      avgValue,
      avgValueChange: pctChange(avgValue, prevAvgValue),
      dineIn: current.dineIn,
      takeaway: current.takeaway,
      grossSales: money(current.grossSales),
      discounts: money(current.discounts),
      tax: money(current.tax),
      serviceCharge: money(current.serviceCharge),
      netSales: money(current.netSales),
      refunds: money(current.refunds),
      collectedCash: money(current.collectedCash),
      range: { from: start.toISOString(), to: end.toISOString() },
    };
  }

  async getRevenueOverTime(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, paymentStatus: "paid", status: { not: "cancelled" } },
      include: REPORT_ORDER_INCLUDE,
    });

    if (diffDays <= 1.5) {
      // Hourly buckets
      const buckets: Record<number, { revenue: Prisma.Decimal; count: number }> = {};
      for (let h = 0; h < 24; h++) buckets[h] = { revenue: new Prisma.Decimal(0), count: 0 };
      for (const order of orders) {
        const hour = Number(formatInTimeZone(order.createdAt, CAIRO_TZ, "H"));
        buckets[hour].revenue = buckets[hour].revenue.add(decimal(order.total));
        buckets[hour].count += 1;
      }
      return {
        granularity: "hourly" as const,
        data: Object.entries(buckets).map(([hour, v]) => ({
          label: `${String(hour).padStart(2, "0")}:00`,
          revenue: money(v.revenue),
          orders: v.count,
        })),
      };
    } else if (diffDays <= 60) {
      // Daily buckets
      const buckets: Record<string, { revenue: Prisma.Decimal; count: number }> = {};
      for (const order of orders) {
        const day = formatInTimeZone(order.createdAt, CAIRO_TZ, "yyyy-MM-dd");
        if (!buckets[day]) buckets[day] = { revenue: new Prisma.Decimal(0), count: 0 };
        buckets[day].revenue = buckets[day].revenue.add(decimal(order.total));
        buckets[day].count += 1;
      }
      return {
        granularity: "daily" as const,
        data: Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, v]) => ({
            label: day,
            revenue: money(v.revenue),
            orders: v.count,
          })),
      };
    } else {
      // Weekly buckets (BE-002: calendar math on Cairo wall date only —
      // no toZonedTime/setDate that depends on server local TZ).
      const buckets: Record<string, { revenue: Prisma.Decimal; count: number }> = {};
      for (const order of orders) {
        const key = cairoWeekStartKey(order.createdAt);
        if (!buckets[key]) buckets[key] = { revenue: new Prisma.Decimal(0), count: 0 };
        buckets[key].revenue = buckets[key].revenue.add(decimal(order.total));
        buckets[key].count += 1;
      }
      return {
        granularity: "weekly" as const,
        data: Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, v]) => ({
            label: week,
            revenue: money(v.revenue),
            orders: v.count,
          })),
      };
    }
  }

  async getOrdersByStatus(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { status: true },
    });

    const counts: Record<string, number> = { received: 0, preparing: 0, ready: 0, completed: 0 };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    const total = orders.length;

    return {
      total,
      statuses: Object.entries(counts).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? round2((count / total) * 100) : 0,
      })),
    };
  }

  async getTopItems(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: "cancelled" } },
      include: { items: { include: { menuItem: { include: { category: true } } } } },
    });

    const itemMap: Record<string, { nameAr: string; nameEn: string; quantity: number; revenue: Prisma.Decimal; categoryAr: string; categoryEn: string }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemMap[key]) {
          itemMap[key] = {
            nameAr: item.nameAr,
            nameEn: item.nameEn,
            quantity: 0,
            revenue: new Prisma.Decimal(0),
            categoryAr: item.menuItem?.category?.nameAr || "",
            categoryEn: item.menuItem?.category?.nameEn || "",
          };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].revenue = itemMap[key].revenue.add(decimal(item.unitPrice).mul(item.quantity));
      }
    }

    const items = Object.values(itemMap);
    const byQuantity = [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const byRevenue = [...items].sort((a, b) => b.revenue.toNumber() - a.revenue.toNumber()).slice(0, 10);

    // Category breakdown
    const catMap: Record<string, { nameAr: string; nameEn: string; revenue: Prisma.Decimal; quantity: number }> = {};
    for (const item of items) {
      const key = item.categoryEn || "Other";
      if (!catMap[key]) {
        catMap[key] = { nameAr: item.categoryAr, nameEn: item.categoryEn, revenue: new Prisma.Decimal(0), quantity: 0 };
      }
      catMap[key].revenue = catMap[key].revenue.add(item.revenue);
      catMap[key].quantity += item.quantity;
    }

    return {
      byQuantity: byQuantity.map((i) => ({ ...i, revenue: money(i.revenue) })),
      byRevenue: byRevenue.map((i) => ({ ...i, revenue: money(i.revenue) })),
      categories: Object.values(catMap)
        .sort((a, b) => b.revenue.toNumber() - a.revenue.toNumber())
        .map((c) => ({ ...c, revenue: money(c.revenue) })),
    };
  }

  async getPeakHours(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { not: "cancelled" } },
      select: { createdAt: true },
    });

    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;
    for (const o of orders) {
      const hour = Number(formatInTimeZone(o.createdAt, CAIRO_TZ, "H"));
      hourCounts[hour] += 1;
    }

    const maxCount = Math.max(...Object.values(hourCounts), 1);

    return {
      hours: Object.entries(hourCounts).map(([hour, count]) => ({
        hour: Number(hour),
        label: `${String(hour).padStart(2, "0")}:00`,
        count,
        intensity: round2(count / maxCount),
      })),
    };
  }

  async getUnavailableItems() {
    const items = await this.prisma.menuItem.findMany({
      where: { available: false },
      select: { id: true, nameAr: true, nameEn: true, price: true, image: true },
    });
    return items.map((i) => ({ ...i, price: numberValue(i.price) }));
  }

  async getTableOccupancy() {
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
        customerName: oldestOrder?.customerName || null,
      };
    });

    return {
      totalTables,
      occupiedTables,
      availableTables,
      occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
      tables: tableDetails,
      range: { from: new Date().toISOString(), to: new Date().toISOString() },
    };
  }

  async getStaleTables() {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { id: "main" },
      select: { staleThresholdMinutes: true },
    });

    const thresholdMinutes = Number(settings?.staleThresholdMinutes ?? 30) || 30;
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
          customerName: oldestOrder.customerName,
        };
      });

    return {
      staleTables,
      thresholdMinutes,
      totalStale: staleTables.length,
    };
  }
}
