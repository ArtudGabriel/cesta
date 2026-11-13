"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NO_PADDING_PREFIXES = ["/login", "/register"];

/**
 * Aplica `pb-16` no body wrapper salvo em rotas auth (onde BottomNav está
 * escondido via HIDDEN_PREFIXES do bottom-nav.tsx — padding viraria espaço
 * morto). Client component porque usa usePathname.
 */
export function BodyPadding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidePadding = NO_PADDING_PREFIXES.some((p) => pathname.startsWith(p));
  return (
    <div className={cn("flex min-h-full flex-1 flex-col", !hidePadding && "pb-16")}>
      {children}
    </div>
  );
}
