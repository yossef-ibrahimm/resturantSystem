import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

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

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  broadcastNewOrder(order: any) {
    this.server.emit("order:new", order);
  }

  broadcastOrderUpdate(order: any) {
    this.server.emit("order:updated", order);
  }
}
