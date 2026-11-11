import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
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
