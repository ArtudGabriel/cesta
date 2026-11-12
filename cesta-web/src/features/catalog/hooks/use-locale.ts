"use client";

import { useAuthStore } from "@/stores/auth.store";

export type UILocale = "es" | "pt-BR";

export function useLocale(): UILocale {
  const locale = useAuthStore((s) => s.user?.locale);
  return (locale ?? "es") as UILocale;
}
