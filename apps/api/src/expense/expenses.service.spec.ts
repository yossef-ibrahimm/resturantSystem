import { BadRequestException } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ExpensesService cash-shift controls", () => {
  const baseSubCategory = { mainCategoryId: "main-1" };
  const baseMainCategory = { id: "main-1", active: true };

  function createService() {
    const prisma = {
      subExpenseCategory: { findFirst: jest.fn() },
      mainExpenseCategory: { findFirst: jest.fn() },
      cashShift: { findFirst: jest.fn() },
      expense: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma.subExpenseCategory.findFirst.mockResolvedValue(baseSubCategory);
    prisma.mainExpenseCategory.findFirst.mockResolvedValue(baseMainCategory);
    prisma.expense.create.mockResolvedValue({ id: "expense-1", amount: 25 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    return { service: new ExpensesService(prisma as unknown as PrismaService), prisma };
  }

  const expenseInput = {
    subCategoryId: "sub-1",
    amount: 25,
    spentAt: "2026-09-05",
    paymentMethod: "cash",
    description: "Supplies",
  };

  it("auto-links a cash expense to the current open shift", async () => {
    const { service, prisma } = createService();
    prisma.cashShift.findFirst.mockResolvedValue({ id: "shift-1", status: "open" });

    await service.create(expenseInput);

    expect(prisma.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashShiftId: "shift-1" }),
    }));
  });

  it("rejects a cash expense when no shift is open", async () => {
    const { service, prisma } = createService();
    prisma.cashShift.findFirst.mockResolvedValue(null);

    await expect(service.create(expenseInput)).rejects.toThrow(BadRequestException);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });
});