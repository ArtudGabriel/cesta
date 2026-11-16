import type { Metadata } from "next";
import { House } from "lucide-react";
import Link from "next/link";
import "./globals.css";

// Sprint 83: not-found.tsx fica fora de [locale] (catch 404 pra URLs sem
// locale valido). Renderiza proprio <html>/<body> ja que root layout.tsx
// foi removido. Textos em ES hardcoded — fallback acessivel e prerender
// estatico sem quebrar cacheComponents.
export const metadata: Metadata = {
  title: "Página no encontrada · Cesta",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <main className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="rounded-full bg-cesta-green/10 p-6">
            <House className="h-12 w-12 text-cesta-green" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Página no encontrada
          </h1>
          <p className="max-w-md text-sm text-muted">
            La página que buscas no existe o fue movida.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-pill bg-cesta-green px-6 text-sm font-semibold text-white hover:bg-cesta-green-dark"
          >
            Volver al inicio
          </Link>
        </main>
      </body>
    </html>
  );
}
