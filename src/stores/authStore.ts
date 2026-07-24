import { create } from "zustand";
import type { User } from "@/lib/types";
import { logout as apiLogout } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token?: string) => void;
  logout: () => void;
}

function loadAuth(): { user: User | null; token: string | null } {
  try {
    const storedUser = localStorage.getItem("tastytable.auth.user");
    const storedToken = localStorage.getItem("tastytable.token");
    return {
      user: storedUser ? JSON.parse(storedUser) : null,
      token: storedToken,
    };
  } catch {
    return { user: null, token: null };
  }
}

const initial = loadAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  token: initial.token,

  setUser: (user, token) => {
    if (user) {
      localStorage.setItem("tastytable.auth.user", JSON.stringify(user));
    } else {
      localStorage.removeItem("tastytable.auth.user");
    }
    if (token !== undefined) {
      if (token) {
        localStorage.setItem("tastytable.token", token);
      } else {
        localStorage.removeItem("tastytable.token");
      }
    }
    set({ user, token: token !== undefined ? token : get().token });
  },

  logout: () => {
    localStorage.removeItem("tastytable.auth.user");
    localStorage.removeItem("tastytable.token");
    apiLogout();
    set({ user: null, token: null });
  },
}));

// Derived selectors (always computed from current state)
export const selectIsAdmin = (state: AuthState) => state.user?.role === "admin";
export const selectIsKitchen = (state: AuthState) => state.user?.role === "kitchen_staff";
export const selectIsWaiter = (state: AuthState) => state.user?.role === "waiter";
export const selectIsAuthenticated = (state: AuthState) => state.user !== null;
