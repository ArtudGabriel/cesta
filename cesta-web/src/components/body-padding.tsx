"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Alinhar com HIDDEN_PREFIXES do bottom-nav.tsx: rotas sem nav também não
// precisam de padding bottom (padding seria espaço morto).
const NO_PADDING_PREFIXES = ["/login", "/register", "/minha-cesta/configurar"];

/**
 * Aplica padding bottom no body wrapper salvo em rotas auth (onde BottomNav
 * está escondido via HIDDEN_PREFIXES do bottom-nav.tsx — padding viraria
 * espaço morto). Client component porque usa usePathname.
 *
 * Sprint 227 (#4 bundle 2): soma `env(safe-area-inset-bottom)` no pb pra
 * cobrir area do home indicator do iPhone. Sem isso, a BottomNav fica em
 * cima do home indicator (viewport-fit=cover ativa safe-area) + content
 * sobe junto cortando a ultima linha. Fallback 0 em dispositivos sem notch.
 */
export function BodyPadding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidePadding = NO_PADDING_PREFIXES.some((p) => pathname.startsWith(p));
  return (
    <div
      className={cn("flex min-h-full flex-1 flex-col")}
      style={
        hidePadding
          ? undefined
          : {
              paddingBottom:
                "calc(4rem + env(safe-area-inset-bottom, 0px))",
            }
      }
    >
      {children}
    </div>
  );
}
