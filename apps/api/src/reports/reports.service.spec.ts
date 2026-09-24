import { Prisma } from "@prisma/client";
import { ReportsService } from "./reports.service";

describe("ReportsService getSummary (PERF-001 SQL aggregates)", () => {
  function makePrisma() {
    const isPaidWhere = (where: unknown) =>
      typeof where === "object" && where !== null && (where as { paymentStatus?: string }).paymentStatus === "paid";

    const moneySum = (items: number, disc: number, tax: number, svc: number, total: number) => ({
      _sum: {
        itemsTotal: new Prisma.Decimal(items),
        discountAmount: new Prisma.Decimal(disc),
        taxAmount: new Prisma.Decimal(tax),
        serviceAmount: new Prisma.Decimal(svc),
        total: new Prisma.Decimal(total),
      },
    });

    const prisma = {
      order: {
        count: jest.fn().mockImplementation(async (args: { where: { createdAt: { gte: Date } } }) => {
          // current range starts 2026-09-01; previous is earlier — use gte day
          const day = args.where.createdAt.gte.getUTCDate();
          // both ranges may share calendar day numbers; distinguish by month isn't reliable.
          // count is only used for orderCount; return based on call order via side channel.
          return day >= 1 ? 3 : 1;
        }),
        aggregate: jest.fn().mockImplementation(async (args: { where: Record<string, unknown> }) => {
          if (isPaidWhere(args.where)) {
            // paid current has 2; paid previous has 1 — distinguish via createdAt gte
            const gte = (args.where.createdAt as { gte: Date }).gte;
            const prev = gte < new Date("2026-08-01T00:00:00.000Z");
            if (prev) {
              return { _sum: { total: new Prisma.Decimal(114) }, _count: { _all: 1 } };
            }
            return { _sum: { total: new Prisma.Decimal(312) }, _count: { _all: 2 } };
          }
          const gte = (args.where.createdAt as { gte: Date }).gte;
          const prev = gte < new Date("2026-08-01T00:00:00.000Z");
          if (prev) return moneySum(100, 0, 9, 5, 114);
          return moneySum(300, 30, 27, 15, 312);
        }),
        groupBy: jest.fn().mockImplementation(async (args: { where: { createdAt: { gte: Date } } }) => {
          const prev = args.where.createdAt.gte < new Date("2026-08-01T00:00:00.000Z");
          if (prev) return [{ orderType: "dine_in", _count: { _all: 1 } }];
          return [
            { orderType: "dine_in", _count: { _all: 2 } },
            { orderType: "takeaway", _count: { _all: 1 } },
          ];
        }),
        findMany: jest.fn(),
      },
      payment: {
        aggregate: jest.fn().mockImplementation(async (args: { where: Record<string, unknown> }) => {
          const order = args.where.order as { createdAt: { gte: Date } };
          const prev = order.createdAt.gte < new Date("2026-08-01T00:00:00.000Z");
          const amountFilter = args.where.amount;
          if (amountFilter) {
            // refunds
            return { _sum: { amount: prev ? new Prisma.Decimal(0) : new Prisma.Decimal(-10) } };
          }
          // cash
          return { _sum: { amount: prev ? new Prisma.Decimal(50) : new Prisma.Decimal(200) } };
        }),
      },
    };
    return prisma;
  }

  it("aggregates summary in SQL without findMany of full order sets", async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as never);
    const result = await service.getSummary("2026-09-01", "2026-09-01");

    expect(prisma.order.findMany).not.toHaveBeenCalled();
    expect(result.revenue).toBe(312);
    expect(result.orderCount).toBe(3);
    expect(result.dineIn).toBe(2);
    expect(result.takeaway).toBe(1);
    expect(result.grossSales).toBe(300);
    expect(result.discounts).toBe(30);
    expect(result.tax).toBe(27);
    expect(result.serviceCharge).toBe(15);
    expect(result.netSales).toBe(312);
    expect(result.refunds).toBe(10);
    expect(result.collectedCash).toBe(200);
    expect(result.avgValue).toBe(156);
  });

  it("handles empty range without dividing by zero", async () => {
    const emptySums = {
      _sum: {
        itemsTotal: null,
        discountAmount: null,
        taxAmount: null,
        serviceAmount: null,
        total: null,
      },
    };
    const prisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue(emptySums).mockResolvedValue({ _sum: { total: null }, _count: { _all: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn(),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };
    // Fix: aggregate is called for money and paid — use mockImplementation
    prisma.order.aggregate = jest.fn().mockImplementation(async (args: { where: { paymentStatus?: string } }) => {
      if (args.where.paymentStatus === "paid") {
        return { _sum: { total: null }, _count: { _all: 0 } };
      }
      return emptySums;
    });

    const service = new ReportsService(prisma as never);
    const result = await service.getSummary("2026-09-01", "2026-09-01");

    expect(result.revenue).toBe(0);
    expect(result.avgValue).toBe(0);
    expect(result.refunds).toBe(0);
    expect(result.collectedCash).toBe(0);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
