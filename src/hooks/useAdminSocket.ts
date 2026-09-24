import { useEffect } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";

/**
 * Establishes and tears down the Socket.io connection for the admin layout.
 * Must be called once at the layout level so all child components
 * (NotificationBell, etc.) can receive real-time events.
 */
export function useAdminSocket() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);
}
