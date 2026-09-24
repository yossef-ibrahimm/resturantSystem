import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import * as dotenv from "dotenv";
import type { Order, RestaurantSettings, Notification, Table } from "@prisma/client";

dotenv.config();

const socketOrigins = (process.env.FRONTEND_URL || "http://localhost:8080")
  .split(",")
  .map((s) => s.trim());

@WebSocketGateway({
  cors: {
    origin: socketOrigins,
    credentials: true,
  },
  namespace: "/",
})
// BE-024: No room/tenant partition — any connected client receives global order
// broadcasts. Acceptable for a single-tenant POS; if multi-tenant is ever added,
// isolate by restaurantId room before broadcasting.
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger(WebsocketGateway.name);

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      // Try to get token from cookie first, then from auth handshake
      let token: string | undefined;

      // Parse cookies from handshake headers
      const cookieHeader = client.handshake.headers?.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/tastytable_token=([^;]+)/);
        if (match) token = match[1];
      }

      // Fallback: try auth handshake (backward compatibility)
      if (!token) {
        token = client.handshake.auth?.token || client.handshake.query?.token as string;
      }

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;

      // Join role-based room
      if (payload.role) {
        client.join(payload.role);
      }
      // Join a personal room for targeted messages
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client connected: ${client.id} (role: ${payload.role})`);
    } catch { /* invalid token */
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastNewOrder(order: Order) {
    this.server.to("kitchen_staff").emit("order:new", order);
    this.server.to("waiter").emit("order:new", order);
    this.server.to("admin").emit("order:new", order);
  }

  broadcastOrderUpdate(order: Order) {
    this.server.to("kitchen_staff").emit("order:updated", order);
    this.server.to("waiter").emit("order:updated", order);
    this.server.to("admin").emit("order:updated", order);
  }

  broadcastSettingsUpdate(settings: RestaurantSettings) {
    this.server.to("kitchen_staff").emit("settings:updated", settings);
    this.server.to("waiter").emit("settings:updated", settings);
    this.server.to("admin").emit("settings:updated", settings);
  }

  broadcastNotification(notification: Notification) {
    this.server.to("admin").emit("notification:new", notification);
  }

  broadcastNotificationResolved(payload: { id: string; sourceType: string; sourceId: string }) {
    this.server.to("admin").emit("notification:resolved", payload);
  }

  broadcastMenuAvailability(payload: { menuItemId: string; available: boolean }) {
    this.server.to("admin").emit("menu:availability", payload);
    this.server.to("kitchen_staff").emit("menu:availability", payload);
    this.server.to("waiter").emit("menu:availability", payload);
  }

  broadcastTableUpdate(
    table: Table | { type: "merge"; mergedGroup: unknown } | { type: "unmerge"; mergedGroupId: string }
  ) {
    this.server.to("admin").emit("table:updated", table);
    this.server.to("waiter").emit("table:updated", table);
    this.server.to("cashier").emit("table:updated", table);
  }
}
