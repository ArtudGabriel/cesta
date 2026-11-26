import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AuthUser } from "@/features/auth/types/auth.types";
import messages from "./i18n/messages/es.json";

/**
 * Sprint 212 — fixture shared por testes unitários. AuthUser agora =
 * `Schemas["UserResponseDto"]` (baseline S211 ADR 0024). Factory preenche
 * campos de preferences/consent/2FA com defaults sensatos.
 */
export function mockAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "test@cesta.app",
    phone: null,
    name: "Test",
    locale: "es",
    roles: ["user"],
    prefersVegan: false,
    prefersVegetarian: false,
    prefersGlutenFree: false,
    prefersLactoseFree: false,
    sortUnitPreference: "absolute",
    nutriSortEnabled: false,
    nutriHealthyOnly: false,
    cookieConsentLevel: "essential",
    cookiesAcceptedAt: null,
    emailVerifiedAt: null,
    twoFactorEnabled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createWrapper() {
  const qc = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="es" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactNode) {
  return render(<>{ui}</>, { wrapper: createWrapper() });
}

export function renderHookWithProviders<T>(hook: () => T) {
  return renderHook(hook, { wrapper: createWrapper() });
}
