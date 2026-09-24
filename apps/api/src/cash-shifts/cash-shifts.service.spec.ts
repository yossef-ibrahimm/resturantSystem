import { Prisma } from "@prisma/client";
import { CashShiftsService } from "./cash-shifts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CashShiftsService reconciliation", () => {
  it("subtracts cash expenses from expected cash", async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const service = new CashShiftsService(prisma as unknown as PrismaService);
    const openShift = { id: "shift-1", openingFloat: new Prisma.Decimal(100) };
    const updatedShift = { id: "shift-1", expectedCash: new Prisma.Decimal(105) };

    prisma.$transaction.mockImplementation(
      async (
        callback: (tx: {
          cashShift: { findFirst: jest.Mock; update: jest.Mock };
          payment: { aggregate: jest.Mock };
          expense: { aggregate: jest.Mock };
        }) => Promise<unknown>
      ) =>
        callback({
          cashShift: {
            findFirst: jest.fn().mockResolvedValue(openShift),
            update: jest.fn().mockResolvedValue(updatedShift),
          },
          payment: {
            aggregate: jest.fn()
              .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(50) } })
              .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(-10) } }),
          },
          expense: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(35) } }),
          },
        })
    );

    const result = await service.close("admin-1", 105);

    expect(result.expectedCash!.toString()).toBe("105");
  });
});
