import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  // Categories
  async findAllCategories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createCategory(data: { nameAr: string; nameEn: string; sortOrder?: number }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: Partial<{ nameAr: string; nameEn: string; sortOrder: number }>) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  // Menu Items
  async findAllMenuItems() {
    return this.prisma.menuItem.findMany({
      include: { variants: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMenuItem(id: string) {
    return this.prisma.menuItem.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  async createMenuItem(data: {
    categoryId: string;
    nameAr: string;
    nameEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    price: number;
    image?: string;
    available?: boolean;
  }) {
    return this.prisma.menuItem.create({ data, include: { variants: true } });
  }

  async updateMenuItem(
    id: string,
    data: Partial<{
      categoryId: string;
      nameAr: string;
      nameEn: string;
      descriptionAr: string;
      descriptionEn: string;
      price: number;
      image: string;
      available: boolean;
    }>
  ) {
    return this.prisma.menuItem.update({
      where: { id },
      data,
      include: { variants: true },
    });
  }

  async deleteMenuItem(id: string) {
    return this.prisma.menuItem.delete({ where: { id } });
  }
}
