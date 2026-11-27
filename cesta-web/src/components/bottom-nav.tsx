"use client";

import {
  Heart,
  House,
  Scale,
  ShoppingCart,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCompareStore } from "@/stores/compare.store";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  key: "home" | "myList" | "favorites" | "compare" | "account";
  Icon: typeof Heart;
  matches: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "home", Icon: House, matches: (p) => p === "/" },
  {
    href: "/minha-lista",
    key: "myList",
    Icon: ShoppingCart,
    matches: (p) => p.startsWith("/minha-lista"),
  },
  {
    href: "/favoritos",
    key: "favorites",
    Icon: Heart,
    matches: (p) => p.startsWith("/favoritos"),
  },
  {
    href: "/comparar",
    key: "compare",
    Icon: Scale,
    matches: (p) => p.startsWith("/comparar"),
  },
  {
    href: "/perfil",
    key: "account",
    Icon: UserCircle,
    matches: (p) => p.startsWith("/perfil"),
  },
];

// Rotas que ocultam a nav (fluxo auth + wizard sticky CTA)
const HIDDEN_PREFIXES = ["/login", "/register", "/minha-cesta/configurar"];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  // Sprint 239 (#12): count de seleção persistida mostra badge no ícone
  // Comparar enquanto o usuário navega por outras rotas. Hidratação só
  // acontece client-side, então pré-rehydrate o count fica em 0 sem
  // flicker (SSR ok).
  const compareCount = useCompareStore((s) => s.ids.length);
  const compareHydrated = useCompareStore((s) => s.isHydrated);

  const isAuthRoute = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (isAuthRoute) return null;

  // Sprint 227 (#1 perf): nav não depende de profile/auth. Links são chrome
  // público; renderiza instant sem network. Removido skeleton + useProfile —
  // elimina 1 fetch, 1 loading state, e o flash content quando 429/transient
  // error reaparece pré-S227 #15. Auth-gated actions ficam dentro das rotas
  // (favoritos, perfil) via LoginGate, não no shell.
  return (
    <nav
      aria-label={t("ariaLabel")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        "border-t border-neutral-200 bg-white/95 backdrop-blur",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map(({ href, key, Icon, matches }) => {
          const active = matches(pathname);
          const label = t(key);
          const showBadge = key === "compare" && compareHydrated && compareCount > 0;
          const badgeLabel = showBadge
            ? t("compareBadge", { count: compareCount })
            : label;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badgeLabel}
                data-testid={`bottom-nav-${key}`}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5",
                  // Sprint 171: tap feedback micro-interaction (cesta-identidade-visual §8).
                  // Respeita prefers-reduced-motion — zero scale/transition quando user opta.
                  "transition-transform duration-100 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
                  active
                    ? "text-cesta-green"
                    : "text-neutral-500 hover:text-ink",
                )}
              >
                <span className="relative inline-flex">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform motion-reduce:transition-none",
                      active && (Icon === Heart ? "fill-current" : "stroke-[2.5] scale-110"),
                    )}
                    aria-hidden
                  />
                  {showBadge && (
                    <span
                      aria-hidden
                      data-testid="bottom-nav-compare-badge"
                      className={cn(
                        "absolute -right-2 -top-2 inline-flex min-w-[16px] items-center justify-center",
                        "rounded-pill bg-cesta-green px-1 text-[10px] font-bold leading-none text-white",
                        "border border-white",
                      )}
                    >
                      {compareCount}
                    </span>
                  )}
                </span>
                <span
                  data-sentry-unmask
                  className={cn(
                    "text-[11px] leading-tight",
                    active && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
