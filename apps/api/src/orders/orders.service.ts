import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WebsocketGateway
  ) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async findByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async create(data: {
    customerName: string;
    phone?: string;
    orderType: "dine_in" | "takeaway";
    tableNumber?: number;
    notes?: string;
    items: {
      menuItemId: string;
      nameAr: string;
      nameEn: string;
      quantity: number;
      unitPrice: number;
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

    // Generate order number atomically via a single-row counter.
    // UPDATE ... SET value = value + 1 is atomic at the DB level, so
    // concurrent order creations can never receive the same number.
    const order = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.orderCounter.upsert({
        where: { id: "singleton" },
        update: { value: { increment: 1 } },
        create: { id: "singleton", value: 1001 },
      });

      return tx.order.create({
        data: {
          orderNumber: String(counter.value),
          customerName: data.customerName,
          phone: data.phone,
          orderType: data.orderType,
          tableNumber: data.tableNumber,
          notes: data.notes,
          status: "received",
          paymentStatus: "unpaid",
          items: {
            create: data.items.map((item) => ({
              menuItemId: item.menuItemId,
              nameAr: item.nameAr,
              nameEn: item.nameEn,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              variant: item.variant,
              notes: item.notes,
            })),
          },
        },
        include: { items: true },
      });
    });

    // Broadcast to kitchen
    this.wsGateway.broadcastNewOrder(order);

    return order;
  }

  async requestBill(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found");

    const updated = await this.prisma.order.update({
      where: { id },
      data: { billRequested: true },
      include: { items: true },
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  async requestBillByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException("Order not found");

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: { billRequested: true },
      include: { items: true },
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  async acknowledgeBill(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found");

    const updated = await this.prisma.order.update({
      where: { id },
      data: { billRequested: false, paymentStatus: "paid" },
      include: { items: true },
    });

    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ["received", "preparing", "ready", "completed"];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException("Invalid status");
    }

    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found");

    // Validate status transition (one-directional only)
    const statusFlow = ["received", "preparing", "ready", "completed"];
    const currentIdx = statusFlow.indexOf(order.status);
    const newIdx = statusFlow.indexOf(status);
    if (newIdx <= currentIdx) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });

    // Broadcast status update
    this.wsGateway.broadcastOrderUpdate(updated);

    return updated;
  }
}
