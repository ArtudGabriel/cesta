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
import { useProfile } from "@/features/profile/hooks/use-profile";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Heart;
  matches: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Inicio",
    Icon: House,
    matches: (p) => p === "/",
  },
  {
    href: "/minha-lista",
    label: "Mi lista",
    Icon: ShoppingCart,
    matches: (p) => p.startsWith("/minha-lista"),
  },
  {
    href: "/favoritos",
    label: "Favoritos",
    Icon: Heart,
    matches: (p) => p.startsWith("/favoritos"),
  },
  {
    href: "/comparar",
    label: "Comparar",
    Icon: Scale,
    matches: (p) => p.startsWith("/comparar"),
  },
  {
    href: "/perfil",
    label: "Cuenta",
    Icon: UserCircle,
    matches: (p) => p.startsWith("/perfil"),
  },
];

// Rotas que ocultam a nav (fluxo auth)
const HIDDEN_PREFIXES = ["/login", "/register"];

export function BottomNav() {
  const pathname = usePathname();
  const { data: profile, isError } = useProfile();

  const isAuthRoute = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  // Não renderiza: rotas de auth OU usuário não logado (profile 401 → isError)
  if (isAuthRoute) return null;
  if (isError || !profile) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        "border-t border-neutral-200 bg-white/95 backdrop-blur",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map(({ href, label, Icon, matches }) => {
          const active = matches(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5",
                  active
                    ? "text-cesta-green"
                    : "text-neutral-500 hover:text-ink",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active && "stroke-[2.5]")}
                  aria-hidden
                />
                <span
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
