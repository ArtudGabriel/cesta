"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authService } from "../services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { PROFILE_KEY } from "@/features/profile/hooks/use-profile";
import { translateError } from "@/lib/translate-error";
import type { LoginPayload, RegisterPayload } from "../types/auth.types";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

// Garante que returnUrl seja relativo (evita open redirect pra outro domínio).
function safeReturnUrl(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

// Sincroniza cookie cesta:locale com profile.locale pós-login/register —
// SSR hierarchy (cookie > Accept-Language > default) agora respeita profile
// do user logado sem depender de /perfil toggle manual.
function syncLocaleCookie(locale: string): void {
  if (typeof document === "undefined") return;
  if (locale !== "es" && locale !== "pt-BR") return;
  document.cookie = `cesta:locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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
  const t = useTranslations("toast");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      syncLocaleCookie(user.locale);
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.removeQueries({ queryKey: PROFILE_KEY });
      toast.success(t("success.welcome"));
      router.push(safeReturnUrl(searchParams.get("returnUrl")));
    },
    onError: (err: Error) => {
      toast.error(translateError(err, tErr));
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const t = useTranslations("toast");
  const tErr = useTranslations("errors");

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      syncLocaleCookie(user.locale);
      qc.setQueryData(AUTH_QUERY_KEY, user);
      qc.removeQueries({ queryKey: PROFILE_KEY });
      toast.success(t("success.accountCreated"));
      router.push(safeReturnUrl(searchParams.get("returnUrl")));
    },
    onError: (err: Error) => {
      toast.error(translateError(err, tErr));
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
