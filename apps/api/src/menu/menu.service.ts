import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { num } from "../common/utils/decimal.util";

type MenuItemWithVariants = Prisma.MenuItemGetPayload<{ include: { variants: true } }>;

function serializeMenuItem(item: MenuItemWithVariants) {
  return {
    ...item,
    price: num(item.price),
    variants: item.variants.map((v) => ({ ...v, priceAdjust: num(v.priceAdjust) })),
  };
}

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private gateway: WebsocketGateway,
  ) {}

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
    const itemCount = await this.prisma.menuItem.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete category: it still contains ${itemCount} menu item(s). Delete or move the items first.`
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // Menu Items
  async findAllMenuItems() {
    const items = await this.prisma.menuItem.findMany({
      where: { deletedAt: null },
      include: { variants: true },
      orderBy: { createdAt: "asc" },
    });
    return items.map(serializeMenuItem);
  }

  async findMenuItem(id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
      include: { variants: true },
    });
    return item ? serializeMenuItem(item) : null;
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
    this.validatePrice(data.price);
    const item = await this.prisma.menuItem.create({ data, include: { variants: true } });
    return serializeMenuItem(item);
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
    if (data.price !== undefined) this.validatePrice(data.price);

    // BE-018: optimistic concurrency — conditional write on updatedAt so a
    // concurrent edit cannot silently clobber (read-then-write TOCTOU).
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new BadRequestException("Menu item not found");
    }

    const result = await this.prisma.menuItem.updateMany({
      where: { id, deletedAt: null, updatedAt: existing.updatedAt },
      data,
    });
    if (result.count === 0) {
      throw new ConflictException("Menu item was modified concurrently — refresh and retry");
    }

    const item = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id },
      include: { variants: true },
    });

    if (data.available !== undefined && data.available !== existing.available) {
      this.gateway.broadcastMenuAvailability({ menuItemId: id, available: data.available });

      if (!data.available) {
        await this.notificationsService.create({
          type: "menu_out_of_stock",
          titleAr: `غير متاح: ${item.nameAr}`,
          titleEn: `Out of Stock: ${item.nameEn}`,
          messageAr: `الطبق «${item.nameAr}» أصبح غير متاح للطلب`,
          messageEn: `Menu item "${item.nameEn}" is now unavailable for ordering`,
          sourceType: "menu",
          sourceId: id,
        });
      } else {
        await this.notificationsService.resolveBySource("menu", id);
      }
    }

    return serializeMenuItem(item);
  }

  private validatePrice(price: number) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Price must be a non-negative amount with at most 2 decimal places");
    }
    const decimalPrice = new Prisma.Decimal(price);
    if (!decimalPrice.eq(decimalPrice.toDecimalPlaces(2))) {
      throw new BadRequestException("Price must be a non-negative amount with at most 2 decimal places");
    }
  }

  async deleteMenuItem(id: string) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, deletedAt: null },
    });

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date(), available: false },
      include: { variants: true },
    });

    if (existing?.available) {
      this.gateway.broadcastMenuAvailability({ menuItemId: id, available: false });
      await this.notificationsService.create({
        type: "menu_out_of_stock",
        titleAr: `غير متاح: ${item.nameAr}`,
        titleEn: `Out of Stock: ${item.nameEn}`,
        messageAr: `الطبق «${item.nameAr}» أصبح غير متاح للطلب (تم الحذف)`,
        messageEn: `Menu item "${item.nameEn}" is now unavailable for ordering (deleted)`,
        sourceType: "menu",
        sourceId: id,
      });
    }

    return serializeMenuItem(item);
  }
}
