import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";

const CAIRO_TZ = "Africa/Cairo";

function cairoStartOfDayUtc(d: Date): Date {
  const ymd = formatInTimeZone(d, CAIRO_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${ymd}T00:00:00`, CAIRO_TZ);
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const prev = getPreviousRange(start, end);

    const [currentOrders, previousOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { items: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: prev.start, lte: prev.end } },
        include: { items: true },
      }),
    ]);

    const calcRevenue = (orders: typeof currentOrders) =>
      round2(
        orders
          .filter((o) => o.paymentStatus === "paid")
          .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), 0)
      );

    const revenue = calcRevenue(currentOrders);
    const prevRevenue = calcRevenue(previousOrders);
    const orderCount = currentOrders.length;
    const prevOrderCount = previousOrders.length;
    const paidCount = currentOrders.filter((o) => o.paymentStatus === "paid").length;
    const prevPaidCount = previousOrders.filter((o) => o.paymentStatus === "paid").length;
    const avgValue = paidCount > 0 ? round2(revenue / paidCount) : 0;
    const prevAvgValue = prevPaidCount > 0 ? round2(prevRevenue / prevPaidCount) : 0;

    const dineIn = currentOrders.filter((o) => o.orderType === "dine_in").length;
    const takeaway = currentOrders.filter((o) => o.orderType === "takeaway").length;

    const pctChange = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return round2(((curr - prev) / prev) * 100);
    };

    return {
      revenue,
      revenueChange: pctChange(revenue, prevRevenue),
      orderCount,
      orderCountChange: pctChange(orderCount, prevOrderCount),
      avgValue,
      avgValueChange: pctChange(avgValue, prevAvgValue),
      dineIn,
      takeaway,
      range: { from: start.toISOString(), to: end.toISOString() },
    };
  }

  async getRevenueOverTime(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, paymentStatus: "paid" },
      include: { items: true },
    });

    if (diffDays <= 1.5) {
      // Hourly buckets
      const buckets: Record<number, { revenue: number; count: number }> = {};
      for (let h = 0; h < 24; h++) buckets[h] = { revenue: 0, count: 0 };
      for (const order of orders) {
        const hour = Number(formatInTimeZone(order.createdAt, CAIRO_TZ, "H"));
        const rev = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[hour].revenue += rev;
        buckets[hour].count += 1;
      }
      return {
        granularity: "hourly" as const,
        data: Object.entries(buckets).map(([hour, v]) => ({
          label: `${String(hour).padStart(2, "0")}:00`,
          revenue: round2(v.revenue),
          orders: v.count,
        })),
      };
    } else if (diffDays <= 60) {
      // Daily buckets
      const buckets: Record<string, { revenue: number; count: number }> = {};
      for (const order of orders) {
        const day = formatInTimeZone(order.createdAt, CAIRO_TZ, "yyyy-MM-dd");
        if (!buckets[day]) buckets[day] = { revenue: 0, count: 0 };
        const rev = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[day].revenue += rev;
        buckets[day].count += 1;
      }
      return {
        granularity: "daily" as const,
        data: Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, v]) => ({
            label: day,
            revenue: round2(v.revenue),
            orders: v.count,
          })),
      };
    } else {
      // Weekly buckets
      const buckets: Record<string, { revenue: number; count: number }> = {};
      for (const order of orders) {
        const zoned = toZonedTime(order.createdAt, CAIRO_TZ);
        const weekStart = new Date(zoned);
        weekStart.setDate(zoned.getDate() - zoned.getDay());
        const key = formatInTimeZone(weekStart, CAIRO_TZ, "yyyy-MM-dd");
        if (!buckets[key]) buckets[key] = { revenue: 0, count: 0 };
        const rev = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        buckets[key].revenue += rev;
        buckets[key].count += 1;
      }
      return {
        granularity: "weekly" as const,
        data: Object.entries(buckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, v]) => ({
            label: week,
            revenue: round2(v.revenue),
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

    const itemMap: Record<string, { nameAr: string; nameEn: string; quantity: number; revenue: number; categoryAr: string; categoryEn: string }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemMap[key]) {
          itemMap[key] = {
            nameAr: item.nameAr,
            nameEn: item.nameEn,
            quantity: 0,
            revenue: 0,
            categoryAr: item.menuItem?.category?.nameAr || "",
            categoryEn: item.menuItem?.category?.nameEn || "",
          };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].revenue += item.unitPrice * item.quantity;
      }
    }

    const items = Object.values(itemMap);
    const byQuantity = [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    const byRevenue = [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Category breakdown
    const catMap: Record<string, { nameAr: string; nameEn: string; revenue: number; quantity: number }> = {};
    for (const item of items) {
      const key = item.categoryEn || "Other";
      if (!catMap[key]) {
        catMap[key] = { nameAr: item.categoryAr, nameEn: item.categoryEn, revenue: 0, quantity: 0 };
      }
      catMap[key].revenue += item.revenue;
      catMap[key].quantity += item.quantity;
    }

    return {
      byQuantity: byQuantity.map((i) => ({ ...i, revenue: round2(i.revenue) })),
      byRevenue: byRevenue.map((i) => ({ ...i, revenue: round2(i.revenue) })),
      categories: Object.values(catMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map((c) => ({ ...c, revenue: round2(c.revenue) })),
    };
  }

  async getPeakHours(from?: string, to?: string) {
    const { start, end } = getRange(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
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
    return this.prisma.menuItem.findMany({
      where: { available: false },
      select: { id: true, nameAr: true, nameEn: true, price: true, image: true },
    });
  }
}
