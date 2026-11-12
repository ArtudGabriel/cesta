"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authService } from "../services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { PROFILE_KEY } from "@/features/profile/hooks/use-profile";
import type { LoginPayload, RegisterPayload } from "../types/auth.types";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

// Garante que returnUrl seja relativo (evita open redirect pra outro domínio).
function safeReturnUrl(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function useMe() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authService.me,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.removeQueries({ queryKey: PROFILE_KEY });
      toast.success("Bienvenido");
      router.push(safeReturnUrl(searchParams.get("returnUrl")));
    },
    onError: (err: Error) => {
      toast.error(err.message || "No pudimos iniciar sesión");
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.removeQueries({ queryKey: PROFILE_KEY });
      toast.success("Cuenta creada");
      router.push(safeReturnUrl(searchParams.get("returnUrl")));
    },
    onError: (err: Error) => {
      toast.error(err.message || "No pudimos crear tu cuenta");
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(refreshToken ?? undefined),
    onSettled: () => {
      clear();
      qc.removeQueries({ queryKey: AUTH_QUERY_KEY });
      qc.removeQueries({ queryKey: PROFILE_KEY });
      router.push("/login");
    },
  });
}
