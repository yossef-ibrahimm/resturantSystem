import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayOrders = await this.prisma.order.findMany({
      where: { createdAt: { gte: startOfDay } },
      include: { items: true },
    });

    const todayRevenue = todayOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce(
        (sum, order) => sum + order.items.reduce((s, item) => s + item.unitPrice * item.quantity, 0),
        0
      );

    // Top items (all time)
    const allOrders = await this.prisma.order.findMany({ include: { items: true } });
    const itemCounts: Record<string, { nameAr: string; nameEn: string; count: number }> = {};
    for (const order of allOrders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemCounts[key]) {
          itemCounts[key] = { nameAr: item.nameAr, nameEn: item.nameEn, count: 0 };
        }
        itemCounts[key].count += item.quantity;
      }
    }
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent orders
    const recentOrders = await this.prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    return {
      todayOrders: todayOrders.length,
      todayRevenue,
      topItems,
      recentOrders,
    };
  }
}
