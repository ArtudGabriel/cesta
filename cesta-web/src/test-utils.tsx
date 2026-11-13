import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import messages from "./i18n/messages/es.json";

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
