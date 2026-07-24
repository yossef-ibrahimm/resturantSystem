import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import type { Order } from "@prisma/client";

@WebSocketGateway({
  cors: {
    origin: ["http://localhost:8080", "http://localhost:5173"],
    credentials: true,
  },
  namespace: "/",
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token as string;

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

      console.log(`Client connected: ${client.id} (role: ${payload.role})`);
    } catch { /* invalid token */
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
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
}
