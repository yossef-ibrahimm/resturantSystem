import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Prisma Decimal -> plain number */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Audit PF-1: top items now aggregate in SQL instead of loading
    // the ENTIRE order history into memory per dashboard view.
    // PERF-002: revenue aggregates in SQL instead of loading orders then
    // filtering paymentStatus === "paid" in JS.
    const [todayOrderCount, revenueAgg, topAgg, recentOrders] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: startOfDay }, status: { not: "cancelled" } },
      }),
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfDay },
          status: { not: "cancelled" },
          paymentStatus: "paid",
        },
        _sum: { total: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { status: { not: "cancelled" } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        where: { status: { not: "cancelled" } },
        include: { items: true },
      }),
    ]);

    const todayRevenue = new Prisma.Decimal(revenueAgg._sum.total ?? 0)
      .toDecimalPlaces(2)
      .toNumber();

    // Resolve names for the aggregated top items (bounded query, not a scan)
    const topIds = topAgg.map((t) => t.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: topIds } },
      select: { id: true, nameAr: true, nameEn: true },
    });
    const nameMap = new Map(menuItems.map((m) => [m.id, m]));

    const topItems = topAgg.map((t) => ({
      nameAr: nameMap.get(t.menuItemId)?.nameAr ?? "",
      nameEn: nameMap.get(t.menuItemId)?.nameEn ?? "",
      count: t._sum.quantity ?? 0,
    }));

    return {
      todayOrders: todayOrderCount,
      todayRevenue,
      topItems,
      recentOrders: recentOrders.map((o) => ({
        ...o,
        items: o.items.map((i) => ({ ...i, unitPrice: new Prisma.Decimal(i.unitPrice).toDecimalPlaces(2).toNumber() })),
      })),
    };
  }
}
