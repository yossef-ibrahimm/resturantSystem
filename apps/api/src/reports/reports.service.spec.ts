import { Prisma } from "@prisma/client";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("uses persisted order totals and excludes cancelled orders", async () => {
    const currentOrder = {
      status: "completed",
      paymentStatus: "paid",
      orderType: "dine_in",
      itemsTotal: new Prisma.Decimal(100),
      discountAmount: new Prisma.Decimal(10),
      taxAmount: new Prisma.Decimal(9),
      serviceAmount: new Prisma.Decimal(5),
      total: new Prisma.Decimal(104),
      payments: [{ amount: new Prisma.Decimal(104), method: "cash" }],
      items: [],
    };
    const prisma = {
      order: {
        findMany: jest.fn()
          .mockResolvedValueOnce([currentOrder])
          .mockResolvedValueOnce([]),
      },
    };
    const service = new ReportsService(prisma as never);

    const result = await service.getSummary("2026-09-01", "2026-09-01");

    expect(result.revenue).toBe(104);
    expect(result.grossSales).toBe(100);
    expect(result.discounts).toBe(10);
    expect(result.tax).toBe(9);
    expect(result.serviceCharge).toBe(5);
    expect(result.netSales).toBe(104);
    expect(result.collectedCash).toBe(104);
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: "cancelled" } }),
    }));
  });
});