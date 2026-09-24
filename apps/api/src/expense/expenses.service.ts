import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { cairoDayStart, cairoDayEnd } from "../common/utils/cairo-time";

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    take?: number;
    skip?: number;
    from?: string;
    to?: string;
    subCategoryId?: string;
    mainCategoryId?: string;
    paymentMethod?: string;
    search?: string;
  }) {
    const take = Math.min(Math.max(params?.take ?? 50, 1), 500);
    const skip = Math.max(params?.skip ?? 0, 0);

    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (params?.from || params?.to) {
      const spentAt: Prisma.DateTimeFilter = {};
      const gte = cairoDayStart(params.from);
      const lte = cairoDayEnd(params.to);
      if (gte) spentAt.gte = gte;
      if (lte) spentAt.lte = lte;
      where.spentAt = spentAt;
    }

    if (params?.subCategoryId) {
      where.subCategoryId = params.subCategoryId;
    }

    if (params?.mainCategoryId) {
      where.subCategory = { mainCategoryId: params.mainCategoryId };
    }

    if (params?.paymentMethod) {
      where.paymentMethod = params.paymentMethod;
    }

    if (params?.search) {
      where.OR = [
        { description: { contains: params.search, mode: "insensitive" } },
        { note: { contains: params.search, mode: "insensitive" } },
        { subCategory: { nameAr: { contains: params.search, mode: "insensitive" } } },
        { subCategory: { nameEn: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          subCategory: {
            include: { mainCategory: { select: { id: true, nameAr: true, nameEn: true } } },
          },
          recordedBy: { select: { id: true, name: true } },
        },
        orderBy: { spentAt: "desc" },
        take,
        skip,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        ...e,
        amount: Number(e.amount),
        mainCategoryNameAr: e.subCategory.mainCategory.nameAr,
        mainCategoryNameEn: e.subCategory.mainCategory.nameEn,
        subCategoryNameAr: e.subCategory.nameAr,
        subCategoryNameEn: e.subCategory.nameEn,
      })),
      total,
      take,
      skip,
    };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: {
        subCategory: {
          include: { mainCategory: true },
        },
        recordedBy: { select: { id: true, name: true } },
        cashShift: { select: { id: true, openedAt: true, status: true } },
      },
    });
    if (!expense) throw new NotFoundException("Expense not found");
    return { ...expense, amount: Number(expense.amount) };
  }

  async create(data: {
    subCategoryId: string;
    amount: number;
    spentAt: Date | string;
    paymentMethod?: string;
    description: string;
    note?: string;
    receiptUrl?: string;
    recordedById?: string;
    cashShiftId?: string;
  }) {
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    // Validate sub-category exists and is active
    const subCat = await this.prisma.subExpenseCategory.findFirst({
      where: { id: data.subCategoryId, deletedAt: null, active: true },
    });
    if (!subCat) {
      throw new BadRequestException("Sub-category not found or inactive");
    }

    // Validate main category is active
    const mainCat = await this.prisma.mainExpenseCategory.findFirst({
      where: { id: subCat.mainCategoryId, deletedAt: null, active: true },
    });
    if (!mainCat) {
      throw new BadRequestException("Main category is inactive");
    }

    let cashShiftId = data.cashShiftId;
    if ((data.paymentMethod || "cash") === "cash") {
      const shift = await this.prisma.cashShift.findFirst({
        where: cashShiftId ? { id: cashShiftId, status: "open" } : { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      if (!shift) {
        throw new BadRequestException("No cash shift is open. Open a shift before recording a cash expense.");
      }
      cashShiftId = shift.id;
    } else if (cashShiftId) {
      const shift = await this.prisma.cashShift.findFirst({ where: { id: cashShiftId, status: "open" } });
      if (!shift) throw new BadRequestException("Cash shift not found or already closed");
    }

    const expense = await this.prisma.expense.create({
      data: {
        subCategoryId: data.subCategoryId,
        amount: new Prisma.Decimal(data.amount),
        spentAt: new Date(data.spentAt),
        paymentMethod: data.paymentMethod || "cash",
        description: data.description,
        note: data.note || null,
        receiptUrl: data.receiptUrl || null,
        recordedById: data.recordedById || null,
        cashShiftId: cashShiftId || null,
      },
      include: {
        subCategory: {
          include: { mainCategory: { select: { id: true, nameAr: true, nameEn: true } } },
        },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: "expense.create",
        entityType: "Expense",
        entityId: expense.id,
        userId: data.recordedById || null,
        afterJson: { ...expense, amount: Number(expense.amount) } as Prisma.InputJsonValue,
      },
    });

    return { ...expense, amount: Number(expense.amount) };
  }

  async update(
    id: string,
    data: Partial<{
      subCategoryId: string;
      amount: number;
      spentAt: Date | string;
      paymentMethod: string;
      description: string;
      note: string;
      receiptUrl: string;
    }>
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Expense not found");

    if (data.subCategoryId) {
      const subCat = await this.prisma.subExpenseCategory.findFirst({
        where: { id: data.subCategoryId, deletedAt: null, active: true },
      });
      if (!subCat) throw new BadRequestException("Sub-category not found or inactive");
    }

    if (data.amount !== undefined && data.amount <= 0) {
      throw new BadRequestException("Amount must be greater than 0");
    }

    const updateData: Prisma.ExpenseUpdateInput = { ...data };
    if (data.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(data.amount);
    }
    if (data.spentAt) {
      updateData.spentAt = new Date(data.spentAt);
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        subCategory: {
          include: { mainCategory: { select: { id: true, nameAr: true, nameEn: true } } },
        },
      },
    });

    return { ...expense, amount: Number(expense.amount) };
  }

  async delete(id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!expense) throw new NotFoundException("Expense not found");

    await this.prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        action: "expense.delete",
        entityType: "Expense",
        entityId: id,
        beforeJson: { ...expense, amount: Number(expense.amount) } as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  }

  async getSummary(params?: { from?: string; to?: string; mainCategoryId?: string; paymentMethod?: string; search?: string }) {
    const where: Prisma.ExpenseWhereInput = { deletedAt: null };

    if (params?.from || params?.to) {
      const spentAt: Prisma.DateTimeFilter = {};
      const gte = cairoDayStart(params.from);
      const lte = cairoDayEnd(params.to);
      if (gte) spentAt.gte = gte;
      if (lte) spentAt.lte = lte;
      where.spentAt = spentAt;
    }

    if (params?.mainCategoryId) where.subCategory = { mainCategoryId: params.mainCategoryId };
    if (params?.paymentMethod) where.paymentMethod = params.paymentMethod;
    if (params?.search) {
      where.OR = [
        { description: { contains: params.search, mode: "insensitive" } },
        { note: { contains: params.search, mode: "insensitive" } },
        { subCategory: { nameAr: { contains: params.search, mode: "insensitive" } } },
        { subCategory: { nameEn: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        subCategory: {
          include: { mainCategory: { select: { id: true, nameAr: true, nameEn: true } } },
        },
      },
    });

    // Group by main category
    const byMainCategory: Record<string, { nameAr: string; nameEn: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const e of expenses) {
      const mainId = e.subCategory.mainCategoryId;
      const mainNameAr = e.subCategory.mainCategory.nameAr;
      const mainNameEn = e.subCategory.mainCategory.nameEn;
      const amount = Number(e.amount);

      if (!byMainCategory[mainId]) {
        byMainCategory[mainId] = { nameAr: mainNameAr, nameEn: mainNameEn, total: 0, count: 0 };
      }
      byMainCategory[mainId].total += amount;
      byMainCategory[mainId].count += 1;
      grandTotal += amount;
    }

    // Group by payment method
    const byPaymentMethod: Record<string, number> = {};
    for (const e of expenses) {
      const method = e.paymentMethod || "cash";
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + Number(e.amount);
    }

    return {
      grandTotal,
      totalCount: expenses.length,
      byMainCategory: Object.entries(byMainCategory).map(([id, v]) => ({
        mainCategoryId: id,
        ...v,
        total: Math.round(v.total * 100) / 100,
      })),
      byPaymentMethod: Object.entries(byPaymentMethod).map(([method, total]) => ({
        method,
        total: Math.round(total * 100) / 100,
      })),
    };
  }
}
