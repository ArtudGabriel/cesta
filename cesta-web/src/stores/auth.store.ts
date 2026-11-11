"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAccessToken } from "@/lib/api";
import type { AuthTokens, AuthUser } from "@/features/auth/types/auth.types";

interface AuthState {
  user: AuthUser | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  updateUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      refreshToken: null,
      isHydrated: false,
      setSession: (user, tokens) => {
        setAccessToken(tokens.accessToken);
        set({ user, refreshToken: tokens.refreshToken });
      },
      updateUser: (user) => set({ user }),
      clear: () => {
        setAccessToken(null);
        set({ user: null, refreshToken: null });
      },
    }),
    {
      name: "cesta-auth",
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
