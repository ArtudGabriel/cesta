import type { ReactNode } from "react";

// Sprint 82: `pb-32` reserva espaço pro CookieBanner (fixed bottom-20, ~130px)
// em mobile 390x836. BottomNav fica oculto em rotas auth (ver bottom-nav.tsx
// HIDDEN_PREFIXES), então banner se sobrepunha ao submit. Padding empurra form
// pra cima deixando ~128px livres abaixo. Guests ainda veem banner; usuários
// que já consentiram ficam com padding morto (trade-off aceito — login/register
// são curtos e sempre centrados).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 pt-8 pb-32">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-extrabold text-cesta-green">
            Cesta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Precios de supermercado en Madrid
          </p>
        </div>
        <div className="rounded-card bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
