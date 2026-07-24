import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

let socket: Socket | null = null;
const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Socket connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
  });

  socket.onAny((event, ...args) => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((cb) => cb(args[0]));
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function onSocketEvent(event: string, callback: (data: unknown) => void): () => void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set());
  }
  eventHandlers.get(event)!.add(callback);

  return () => {
    eventHandlers.get(event)?.delete(callback);
  };
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
