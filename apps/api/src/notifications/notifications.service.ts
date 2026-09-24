import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import type { NotificationType } from "@prisma/client";

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: WebsocketGateway,
  ) {}

  async create(params: {
    type: NotificationType;
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
    sourceType: string;
    sourceId: string;
  }) {
    const existing = await this.prisma.notification.findFirst({
      where: {
        type: params.type,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        resolvedAt: null,
      },
    });

    if (existing) return existing;

    const notification = await this.prisma.notification.create({ data: params });
    this.gateway.broadcastNotification(notification);
    return notification;
  }

  async findAll(params?: { unreadOnly?: boolean }) {
    const where: { isRead?: boolean; resolvedAt?: null } = {};
    if (params?.unreadOnly) {
      where.isRead = false;
      where.resolvedAt = null;
    }
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getUnreadCount() {
    const count = await this.prisma.notification.count({
      where: { isRead: false, resolvedAt: null },
    });
    return { count };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead() {
    return this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }

  async resolveBySource(sourceType: string, sourceId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        sourceType,
        sourceId,
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), isRead: true },
    });

    if (result.count > 0) {
      this.gateway.broadcastNotificationResolved({ id: "", sourceType, sourceId });
    }

    return result;
  }

  async delete(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }
}
