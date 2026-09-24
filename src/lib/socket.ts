import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "/";

let socket: Socket | null = null;
let refCount = 0;
const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

export function connectSocket(): Socket {
  refCount++;
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    // connected
  });

  socket.on("disconnect", () => {
    // disconnected
  });

  socket.on("connect_error", () => {
    // connection error
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
  refCount--;
  if (refCount <= 0 && socket) {
    refCount = 0;
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
