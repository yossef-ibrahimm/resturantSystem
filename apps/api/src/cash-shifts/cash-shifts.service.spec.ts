import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CashShiftsService } from "./cash-shifts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CashShiftsService reconciliation", () => {
  function mockTx(opts?: {
    openingFloat?: number;
    cashIn?: number;
    cashOut?: number;
    cashExpense?: number;
    varianceThreshold?: number | null;
  }) {
    const openingFloat = opts?.openingFloat ?? 100;
    const cashIn = opts?.cashIn ?? 50;
    const cashOut = opts?.cashOut ?? -10;
    const cashExpense = opts?.cashExpense ?? 35;
    const varianceThreshold = opts?.varianceThreshold === undefined ? 50 : opts.varianceThreshold;

    const openShift = { id: "shift-1", openingFloat: new Prisma.Decimal(openingFloat) };

    return {
      openShift,
      tx: {
        cashShift: {
          findFirst: jest.fn().mockResolvedValue(openShift),
          update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
            id: "shift-1",
            status: "closed",
            expectedCash: args.data.expectedCash,
            variance: args.data.variance,
            closingFloat: args.data.closingFloat,
            notes: args.data.notes,
          })),
        },
        payment: {
          aggregate: jest.fn()
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(cashIn) } })
            .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(cashOut) } }),
        },
        expense: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(cashExpense) } }),
        },
        restaurantSettings: {
          findUnique: jest.fn().mockResolvedValue({ cashShiftVarianceThreshold: varianceThreshold }),
        },
      },
    };
  }

  function serviceWith(tx: unknown) {
    const prisma = {
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    return { service: new CashShiftsService(prisma as unknown as PrismaService), prisma };
  }

  it("subtracts cash expenses from expected cash", async () => {
    const { tx } = mockTx();
    const { service } = serviceWith(tx);

    const result = await service.close("admin-1", 105);

    // 100 + 50 - 10 - 35 = 105
    expect(result.expectedCash!.toString()).toBe("105");
    expect(result.variance!.toString()).toBe("0");
  });

  it("throws when variance exceeds threshold without notes (BE-013)", async () => {
    // expected = 105, closing = 0 → variance = -105, |v| > 50
    const { tx } = mockTx();
    const { service } = serviceWith(tx);

    await expect(service.close("admin-1", 0)).rejects.toThrow(/exceeds threshold/);
    expect(tx.cashShift.update).not.toHaveBeenCalled();
  });

  it("allows variance over threshold when notes are provided (BE-013)", async () => {
    const { tx } = mockTx();
    const { service } = serviceWith(tx);

    const result = await service.close("admin-1", 0, "Drawer short — investigated, till error");
    expect(result.status).toBe("closed");
    expect(tx.cashShift.update).toHaveBeenCalled();
  });

  it("allows within-threshold variance without notes", async () => {
    // expected = 105, closing = 100 → variance = -5, |v| <= 50
    const { tx } = mockTx();
    const { service } = serviceWith(tx);

    const result = await service.close("admin-1", 100);
    expect(result.variance!.toString()).toBe("-5");
  });
});
