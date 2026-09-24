import { create } from "zustand";
import type { User } from "@/lib/types";
import { logout as apiLogout } from "@/lib/api";

interface AuthState {
  user: User | null;
  hasHydrated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

function loadAuth(): { user: User | null } {
  try {
    const storedUser = localStorage.getItem("tastytable.auth.user");
    return {
      user: storedUser ? JSON.parse(storedUser) : null,
    };
  } catch {
    return { user: null };
  }
}

const initial = loadAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  hasHydrated: true,

  setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

  setUser: (user) => {
    if (user) {
      localStorage.setItem("tastytable.auth.user", JSON.stringify(user));
    } else {
      localStorage.removeItem("tastytable.auth.user");
    }
    set({ user });
  },

  logout: () => {
    localStorage.removeItem("tastytable.auth.user");
    apiLogout();
    set({ user: null });
  },
}));

// Derived selector
export const selectIsAuthenticated = (state: AuthState) => state.user !== null;
