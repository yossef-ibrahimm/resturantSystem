import { BadRequestException } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ExpensesService cash-shift controls", () => {
  const baseSubCategory = { mainCategoryId: "main-1" };
  const baseMainCategory = { id: "main-1", active: true };

  function createService() {
    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    };
    const tx = {
      subExpenseCategory: { findFirst: jest.fn() },
      mainExpenseCategory: { findFirst: jest.fn() },
      cashShift: { findFirst: jest.fn() },
      expense: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    tx.subExpenseCategory.findFirst.mockResolvedValue(baseSubCategory);
    tx.mainExpenseCategory.findFirst.mockResolvedValue(baseMainCategory);
    tx.expense.create.mockResolvedValue({ id: "expense-1", amount: 25, recordedById: null });
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
    return {
      service: new ExpensesService(prisma as unknown as PrismaService),
      prisma,
      tx,
    };
  }

  const expenseInput = {
    subCategoryId: "sub-1",
    amount: 25,
    spentAt: "2026-09-05",
    paymentMethod: "cash",
    description: "Supplies",
  };

  it("auto-links a cash expense to the current open shift", async () => {
    const { service, tx } = createService();
    tx.cashShift.findFirst.mockResolvedValue({ id: "shift-1", status: "open" });

    await service.create(expenseInput);

    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashShiftId: "shift-1" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("rejects a cash expense when no shift is open", async () => {
    const { service, tx } = createService();
    tx.cashShift.findFirst.mockResolvedValue(null);

    await expect(service.create(expenseInput)).rejects.toThrow(BadRequestException);
    expect(tx.expense.create).not.toHaveBeenCalled();
  });

  it("audits expense updates in the same transaction (BE-017)", async () => {
    const { service, tx } = createService();
    tx.expense.findFirst.mockResolvedValue({
      id: "expense-1",
      amount: 25,
      recordedById: "user-1",
      deletedAt: null,
    });
    tx.expense.update.mockResolvedValue({
      id: "expense-1",
      amount: 30,
      recordedById: "user-1",
      subCategory: { nameAr: "a", nameEn: "b", mainCategory: { id: "main-1", nameAr: "x", nameEn: "y" } },
    });

    await service.update("expense-1", { amount: 30 });

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "expense.update", entityId: "expense-1" }),
      })
    );
  });
});
