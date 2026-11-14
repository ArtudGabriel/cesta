"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAccessToken } from "@/lib/api";
import type { AuthTokens, AuthUser } from "@/features/auth/types/auth.types";

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  updateUser: (user: AuthUser) => void;
  clear: () => void;
}

/**
 * Sprint 54: refresh token saiu do estado — virou cookie httpOnly gerenciado
 * pelo browser. Store persiste só o user; access token fica em memória via
 * lib/api.setAccessToken (localStorage pra SSR cookie bridge).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isHydrated: false,
      setSession: (user, tokens) => {
        setAccessToken(tokens.accessToken);
        set({ user });
      },
      updateUser: (user) => set({ user }),
      clear: () => {
        setAccessToken(null);
        set({ user: null });
      },
    }),
    {
      name: "cesta-auth",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
