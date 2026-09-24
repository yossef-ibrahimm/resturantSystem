import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExpenseCategoriesService {
  constructor(private prisma: PrismaService) {}

  // ─── Main Expense Categories ───

  async findAllMainCategories() {
    return this.prisma.mainExpenseCategory.findMany({
      where: { deletedAt: null },
      include: {
        subCategories: {
          where: { deletedAt: null },
          orderBy: { nameAr: "asc" },
        },
        _count: { select: { subCategories: { where: { deletedAt: null } } } },
      },
      orderBy: { nameAr: "asc" },
    });
  }

  async findActiveMainCategories() {
    return this.prisma.mainExpenseCategory.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { nameAr: "asc" },
    });
  }

  async findMainCategory(id: string) {
    const cat = await this.prisma.mainExpenseCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        subCategories: {
          where: { deletedAt: null },
          orderBy: { nameAr: "asc" },
        },
      },
    });
    if (!cat) throw new NotFoundException("Main expense category not found");
    return cat;
  }

  async createMainCategory(data: { nameAr: string; nameEn: string; description?: string }) {
    return this.prisma.mainExpenseCategory.create({ data });
  }

  async updateMainCategory(
    id: string,
    data: Partial<{ nameAr: string; nameEn: string; description: string; active: boolean }>
  ) {
    const cat = await this.prisma.mainExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cat) throw new NotFoundException("Main expense category not found");
    return this.prisma.mainExpenseCategory.update({ where: { id }, data });
  }

  async deleteMainCategory(id: string) {
    const cat = await this.prisma.mainExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cat) throw new NotFoundException("Main expense category not found");

    const subCount = await this.prisma.subExpenseCategory.count({
      where: { mainCategoryId: id, deletedAt: null },
    });
    if (subCount > 0) {
      throw new BadRequestException(
        `Cannot delete: category has ${subCount} sub-categories. Deactivate or delete them first.`
      );
    }

    return this.prisma.mainExpenseCategory.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  // ─── Sub Expense Categories ───

  async findAllSubCategories(params?: { mainCategoryId?: string }) {
    const where: Prisma.SubExpenseCategoryWhereInput = { deletedAt: null };
    if (params?.mainCategoryId) where.mainCategoryId = params.mainCategoryId;

    return this.prisma.subExpenseCategory.findMany({
      where,
      include: {
        mainCategory: { select: { id: true, nameAr: true, nameEn: true } },
        _count: { select: { expenses: true } },
      },
      orderBy: { nameAr: "asc" },
    });
  }

  async findActiveSubCategories(mainCategoryId?: string) {
    const where: Prisma.SubExpenseCategoryWhereInput = { active: true, deletedAt: null };
    if (mainCategoryId) where.mainCategoryId = mainCategoryId;

    return this.prisma.subExpenseCategory.findMany({
      where,
      include: { mainCategory: { select: { id: true, nameAr: true, nameEn: true } } },
      orderBy: { nameAr: "asc" },
    });
  }

  async findSubCategory(id: string) {
    const cat = await this.prisma.subExpenseCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        mainCategory: true,
        _count: { select: { expenses: true } },
      },
    });
    if (!cat) throw new NotFoundException("Sub expense category not found");
    return cat;
  }

  async createSubCategory(data: {
    mainCategoryId: string;
    nameAr: string;
    nameEn: string;
    description?: string;
  }) {
    const main = await this.prisma.mainExpenseCategory.findFirst({
      where: { id: data.mainCategoryId, deletedAt: null, active: true },
    });
    if (!main) {
      throw new BadRequestException("Main category not found or inactive");
    }
    return this.prisma.subExpenseCategory.create({ data });
  }

  async updateSubCategory(
    id: string,
    data: Partial<{ nameAr: string; nameEn: string; description: string; active: boolean; mainCategoryId: string }>
  ) {
    const cat = await this.prisma.subExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cat) throw new NotFoundException("Sub expense category not found");

    if (data.mainCategoryId) {
      const main = await this.prisma.mainExpenseCategory.findFirst({
        where: { id: data.mainCategoryId, deletedAt: null, active: true },
      });
      if (!main) throw new BadRequestException("Main category not found or inactive");
    }

    return this.prisma.subExpenseCategory.update({ where: { id }, data });
  }

  async deleteSubCategory(id: string) {
    const cat = await this.prisma.subExpenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cat) throw new NotFoundException("Sub expense category not found");

    const expenseCount = await this.prisma.expense.count({
      where: { subCategoryId: id, deletedAt: null },
    });
    if (expenseCount > 0) {
      throw new BadRequestException(
        `Cannot delete: sub-category has ${expenseCount} expense entries. Deactivate instead.`
      );
    }

    return this.prisma.subExpenseCategory.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
