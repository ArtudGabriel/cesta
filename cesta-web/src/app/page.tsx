"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/features/auth/hooks/use-auth";
import { useAuthStore } from "@/stores/auth.store";

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const me = useMe();
  const logout = useLogout();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-extrabold text-cesta-green">
        Cesta
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Compara precios de supermercado en la Comunidad de Madrid.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
        {[
          "mercadona",
          "carrefour",
          "alcampo",
          "lidl",
          "froiz",
          "dia",
          "aldi",
        ].map((name) => (
          <span
            key={name}
            className="rounded-pill bg-surface px-3 py-1 font-medium text-muted"
          >
            {name}
          </span>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        {!isHydrated ? null : user ? (
          <>
            <p className="text-sm text-ink">
              Hola, <strong>{me.data?.name ?? user.email ?? user.phone}</strong>
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Cerrar sesión
            </Button>
          </>
        ) : (
          <div className="flex gap-3">
            <Button asChild size="sm">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
