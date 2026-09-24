import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { StockService } from "../inventory/stock.service";
import { PaymentsService } from "./payments.service";
import { num } from "../common/utils/decimal.util";

const STATUS_FLOW: string[] = ["received", "preparing", "ready", "completed"];

// Per-stage audit columns (decision A1): each forward transition stamps who + when
const STAGE_FIELDS: Record<string, { at: string; byId: string }> = {
  preparing: { at: "preparingAt", byId: "preparingById" },
  ready: { at: "readyAt", byId: "readyById" },
  completed: { at: "completedAt", byId: "completedById" },
};

const ORDER_INCLUDE = { items: true } satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Named money rebase for discounts (BE-005): tax and service are recalculated
 * on the discounted base (post-discount tax), not left on the pre-discount base.
 * Single source of truth — tests live in orders.service.spec.ts.
 */
export function rebaseTaxAfterDiscount(
  discountedBase: number,
  taxRate: number,
  serviceRate: number,
): { taxAmount: number; serviceAmount: number; total: number } {
  const base = new Prisma.Decimal(discountedBase);
  const taxAmount = base.mul(taxRate).toDecimalPlaces(2);
  const serviceAmount = base.mul(serviceRate).toDecimalPlaces(2);
  const total = base.add(taxAmount).add(serviceAmount).toDecimalPlaces(2);
  return {
    taxAmount: taxAmount.toNumber(),
    serviceAmount: serviceAmount.toNumber(),
    total: total.toNumber(),
  };
}

function serializeOrder(order: OrderWithItems) {
  return {
    ...order,
    itemsTotal: num(order.itemsTotal),
    discountAmount: num(order.discountAmount),
    taxRate: num(order.taxRate),
    taxAmount: num(order.taxAmount),
    serviceRate: num(order.serviceRate),
    serviceAmount: num(order.serviceAmount),
    total: num(order.total),
    paidTotal: num(order.paidTotal),
    items: order.items.map((i) => ({ ...i, unitPrice: num(i.unitPrice) })),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway,
    private stockService: StockService,
    private paymentsService: PaymentsService,
  ) {}

  async findAll(params: { status?: string; take?: number; cursor?: string; from?: string; to?: string } = {}) {
    // Clamp page size (audit CQ-2: endpoint previously returned entire history)
    const take = Math.min(Math.max(Math.floor(params.take ?? 200), 1), 500);

    let status: Prisma.OrderWhereInput["status"];
    if (params.status && params.status !== "all") {
      if (!(STATUS_FLOW.includes(params.status) || params.status === "cancelled")) {
        throw new BadRequestException("Invalid status filter");
      }
      status = { equals: params.status as OrderStatus };
    }

    const createdAt = params.from || params.to
      ? {
          ...(params.from ? { gte: new Date(params.from) } : {}),
          ...(params.to ? { lte: new Date(params.to) } : {}),
        }
      : undefined;

    const orders = await this.prisma.order.findMany({
      where: { ...(status ? { status } : {}), ...(createdAt ? { createdAt } : {}) },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take,
    });

    return orders.map(serializeOrder);
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrder(order);
  }

  async findByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrder(order);
  }

  /**
   * Public lookup keyed by opaque token. The 4-digit orderNumber is no longer
   * an enumeration vector: this is the only public read path.
   */
  async findByToken(orderToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderToken },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrder(order);
  }

  /**
   * Server-authoritative pricing (audit SEC-1):
   * names and unit prices ALWAYS come from the database, never from the client.
   * The client sends only menuItemId / quantity / variant label / notes.
   */
  async create(data: {
    customerName: string;
    phone?: string;
    orderType: "dine_in" | "takeaway";
    tableNumber?: number;
    notes?: string;
    idempotencyKey?: string;
    createdByUserId?: string;
    items: {
      menuItemId: string;
      quantity: number;
      variant?: string;
      notes?: string;
    }[];
  }) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException("Order must have at least one item");
    }
    if (data.orderType === "dine_in" && !data.tableNumber) {
      throw new BadRequestException("Table number is required for dine-in orders");
    }
    if (data.tableNumber != null && (!Number.isFinite(data.tableNumber) || data.tableNumber < 1 || data.tableNumber > 500)) {
      throw new BadRequestException("Table number must be a valid integer between 1 and 500");
    }

    // Idempotency: if key provided, return existing order
    if (data.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: ORDER_INCLUDE,
      });
      if (existing) return serializeOrder(existing);
    }

    // Resolve every ordered item against the live menu
    const uniqueIds = [...new Set(data.items.map((i) => i.menuItemId))];
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: uniqueIds } },
      include: { variants: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    const resolved = data.items.map((item) => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem || menuItem.deletedAt || !menuItem.available) {
        throw new BadRequestException("Order contains an unknown or unavailable item");
      }

      let unitPrice = num(menuItem.price);
      let variantLabel: string | null = null;
      if (item.variant) {
        const variant = menuItem.variants.find(
          (v) => v.nameEn === item.variant || v.nameAr === item.variant
        );
        if (!variant) {
          throw new BadRequestException("Unknown variant");
        }
        variantLabel = item.variant;
        unitPrice += num(variant.priceAdjust);
      }

      return {
        menuItemId: menuItem.id,
        nameAr: menuItem.nameAr,
        nameEn: menuItem.nameEn,
        quantity: item.quantity,
        unitPrice,
        variant: variantLabel,
        notes: item.notes,
      };
    });

    // Compute money snapshot using Prisma Decimal for precision.
    // All monetary arithmetic is done in Decimal; only convert at the end.
    const itemsTotal = resolved.reduce(
      (sum, i) => sum.add(new Prisma.Decimal(i.unitPrice).mul(i.quantity)),
      new Prisma.Decimal(0)
    );

    // Generate order number via a single-row counter inside a transaction.
    // On P2002 (unique constraint collision), self-heal by re-seeding the
    // counter to MAX(orderNumber) + 1, then retry.
    const MAX_RETRIES = 5;
    let order: OrderWithItems | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        order = await this.prisma.$transaction(async (tx) => {
          const counter = await tx.orderCounter.upsert({
            where: { id: "singleton" },
            update: { value: { increment: 1 } },
            create: { id: "singleton", value: 1001 },
          });

          // Fetch tax/service settings inside the transaction for snapshot accuracy
          const settings = await tx.restaurantSettings.findUnique({
            where: { id: "main" },
            select: { taxEnabled: true, taxRate: true, serviceEnabled: true, serviceRate: true },
          });

          const taxEnabled = settings?.taxEnabled ?? false;
          const serviceEnabled = settings?.serviceEnabled ?? false;
          const taxRate = taxEnabled ? new Prisma.Decimal(settings?.taxRate ?? 0) : new Prisma.Decimal(0);
          const serviceRate = serviceEnabled ? new Prisma.Decimal(settings?.serviceRate ?? 0) : new Prisma.Decimal(0);

          const taxAmount = itemsTotal.mul(taxRate).toDecimalPlaces(2);
          const serviceAmount = itemsTotal.mul(serviceRate).toDecimalPlaces(2);
          const discountAmount = new Prisma.Decimal(0); // discounts not yet implemented
          const total = itemsTotal.sub(discountAmount).add(taxAmount).add(serviceAmount).toDecimalPlaces(2);

          return tx.order.create({
            data: {
              orderNumber: String(counter.value),
              idempotencyKey: data.idempotencyKey || null,
              customerName: data.customerName,
              phone: data.phone,
              orderType: data.orderType,
              tableNumber: data.tableNumber,
              notes: data.notes,
              status: "received",
              paymentStatus: "unpaid",
              createdByUserId: data.createdByUserId || null,
              itemsTotal: itemsTotal.toDecimalPlaces(2),
              discountAmount: discountAmount.toDecimalPlaces(2),
              taxRate: taxRate.toDecimalPlaces(4),
              taxAmount: taxAmount.toDecimalPlaces(2),
              serviceRate: serviceRate.toDecimalPlaces(4),
              serviceAmount: serviceAmount.toDecimalPlaces(2),
              total: total.toDecimalPlaces(2),
              items: {
                create: resolved,
              },
            },
            include: ORDER_INCLUDE,
          });
        });
        break;
      } catch (err: any) {
        if (err?.code === "P2002" && attempt < MAX_RETRIES - 1) {
          const [{ max }] = await this.prisma.$queryRaw<{ max: number }[]>`
            SELECT COALESCE(MAX(CAST("orderNumber" AS INTEGER)), 1000) + 1 AS max
            FROM "Order"`;
          await this.prisma.$executeRaw`
            INSERT INTO "OrderCounter" ("id", "value")
            VALUES ('singleton', ${max})
            ON CONFLICT ("id") DO UPDATE SET value = ${max}`;
          continue;
        }
        throw err;
      }
    }
    if (!order) throw new BadRequestException("Failed to create order after retries");

    // Broadcast to kitchen
    this.wsGateway.broadcastNewOrder(order);

    return order;
  }

  async requestBill(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { paymentStatus: true, status: true } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid" || order.status === "cancelled") {
      throw new BadRequestException("Bill cannot be requested for a paid or cancelled order");
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { billRequested: true },
      include: ORDER_INCLUDE,
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  async requestBillByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid" || order.status === "cancelled") {
      throw new BadRequestException("Bill cannot be requested for a paid or cancelled order");
    }

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: { billRequested: true },
      include: ORDER_INCLUDE,
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  async requestBillByToken(orderToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderToken },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid" || order.status === "cancelled") {
      throw new BadRequestException("Bill cannot be requested for a paid or cancelled order");
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { billRequested: true },
      include: ORDER_INCLUDE,
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  /**
   * Acknowledge bill: creates a payment for the remaining balance via PaymentsService.
   * Uses the same createPayment flow as the cashier (single full-amount cash payment).
   */
  async acknowledgeBill(id: string, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, paymentStatus: true, status: true, total: true, paidTotal: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid") {
      throw new BadRequestException("Order is already paid");
    }
    if (order.status === "cancelled") {
      throw new BadRequestException("Cannot pay for a cancelled order");
    }

    const remaining = Number(order.total) - Number(order.paidTotal);
    if (remaining <= 0) {
      throw new BadRequestException("No remaining balance to pay");
    }

    // Create payment via PaymentsService (unified flow with cashier)
    const idempotencyKey = `ack-bill-${id}-${Date.now()}`;
    await this.paymentsService.createPayment({
      orderId: id,
      amount: remaining,
      method: "cash",
      idempotencyKey,
      actorId,
      note: "Bill acknowledged — full payment",
    });

    // Clear billRequested
    await this.prisma.order.update({
      where: { id },
      data: { billRequested: false },
    });

    const updated = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!updated) throw new NotFoundException("Order not found");

    return updated;
  }

  /**
   * Race-safe transition (audit CQ-5): guarded updateMany inside a transaction.
   * The loser of a concurrent race gets count=0 -> 409 instead of silently clobbering.
   *
   * Note: stock consumption on 'preparing' is intentionally NOT triggered here.
   * Per the business decision, inventory is managed manually (raw materials,
   * not auto-decremented by sales). See stock.service.ts.
   */
  async updateStatus(id: string, status: string, actorId?: string) {
    if (!STATUS_FLOW.includes(status)) {
      throw new BadRequestException("Invalid status");
    }

    const stage = STAGE_FIELDS[status];

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, select: { status: true } });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status === "cancelled") {
        throw new BadRequestException("Cancelled orders cannot be progressed");
      }

      const currentIdx = STATUS_FLOW.indexOf(order.status);
      const newIdx = STATUS_FLOW.indexOf(status);
      if (newIdx <= currentIdx) {
        throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
      }

      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: status as OrderStatus,
          ...(stage
            ? { [stage.at]: new Date(), [stage.byId]: actorId ?? null }
            : {}),
        },
      });
      if (result.count === 0) {
        throw new ConflictException("Order was modified concurrently — refresh and retry");
      }

      return tx.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    });

    if (!updated) throw new NotFoundException("Order not found");

    this.wsGateway.broadcastOrderUpdate(updated);

    return serializeOrder(updated);
  }

  /** Admin-only cancellation (decision A3/A4): only received/preparing, never auto-restocks */
  async cancel(id: string, reason: string, actorId?: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Cancellation reason is required");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, select: { status: true } });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status !== "received" && order.status !== "preparing") {
        throw new BadRequestException("Only received or preparing orders can be cancelled");
      }

      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelledById: actorId ?? null,
          cancelReason: reason.trim(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException("Order was modified concurrently — refresh and retry");
      }

      return tx.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    });

    if (!updated) throw new NotFoundException("Order not found");

    this.wsGateway.broadcastOrderUpdate(updated);

    return serializeOrder(updated);
  }

  /** Cashier cancellation: only "received" orders, no reason required */
  async cancelByCashier(id: string, actorId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, select: { status: true } });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status !== "received") {
        throw new BadRequestException("Cashier can only cancel orders that haven't been started by the kitchen");
      }

      const result = await tx.order.updateMany({
        where: { id, status: "received" },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelledById: actorId,
          cancelReason: "Cancelled by cashier",
        },
      });
      if (result.count === 0) {
        throw new ConflictException("Order was modified concurrently — refresh and retry");
      }

      return tx.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    });

    if (!updated) throw new NotFoundException("Order not found");

    this.wsGateway.broadcastOrderUpdate(updated);

    return serializeOrder(updated);
  }

  /**
   * Admin-only discount on an existing order.
   * Recomputes total server-side with post-discount tax/service rebase (BE-005):
   *   discountedBase = itemsTotal - discountAmount
   *   taxAmount      = discountedBase * taxRate
   *   serviceAmount  = discountedBase * serviceRate
   *   total          = discountedBase + taxAmount + serviceAmount
   * discountAmount must be > 0 and <= itemsTotal (cannot make order negative).
   * Once any payment exists, the discount is still allowed but the cashier is warned via UI.
   */
  async applyDiscount(id: string, amount: number, reason: string, actorId: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Discount amount must be a positive number");
    }
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Discount reason is required");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          itemsTotal: true,
          taxRate: true,
          serviceRate: true,
          paidTotal: true,
          status: true,
        },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status === "cancelled" || order.status === "completed") {
        throw new BadRequestException("Cannot discount a cancelled or completed order");
      }
      if (new Prisma.Decimal(order.paidTotal).gt(0)) {
        throw new BadRequestException("Cannot apply a discount after payment has been recorded");
      }
      if (amount > Number(order.itemsTotal)) {
        throw new BadRequestException(
          `Discount (${amount}) cannot exceed items total (${order.itemsTotal})`
        );
      }

      const discountedBase = new Prisma.Decimal(order.itemsTotal)
        .sub(amount)
        .toDecimalPlaces(2)
        .toNumber();
      const { taxAmount, serviceAmount, total } = rebaseTaxAfterDiscount(
        discountedBase,
        Number(order.taxRate),
        Number(order.serviceRate),
      );

      const res = await tx.order.update({
        where: { id },
        data: {
          discountAmount: new Prisma.Decimal(amount).toDecimalPlaces(2),
          discountReason: reason.trim(),
          discountedById: actorId,
          taxAmount: new Prisma.Decimal(taxAmount),
          serviceAmount: new Prisma.Decimal(serviceAmount),
          total: new Prisma.Decimal(total),
        },
        include: ORDER_INCLUDE,
      });
      return res;
    });

    this.wsGateway.broadcastOrderUpdate(updated);
    return serializeOrder(updated);
  }
}
