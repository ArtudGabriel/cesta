"use client";

import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useReceipt,
  useRemoveReceipt,
} from "@/features/expenses/hooks/use-expenses";
import { formatPrice } from "@/lib/utils";

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: receipt, isLoading } = useReceipt(params.id);
  const remove = useRemoveReceipt();

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-coral">Ticket no encontrado.</p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/gastos">Volver</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/gastos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="line-clamp-1 flex-1 font-display text-lg font-bold text-ink">
          {receipt.supermarketName ?? "Ticket"}
        </h1>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Eliminar"
          onClick={() => {
            if (confirm("¿Eliminar este ticket?")) remove.mutate(receipt.id);
          }}
        >
          <Trash2 className="h-5 w-5 text-coral" />
        </Button>
      </header>

      <div className="px-4 py-4 space-y-4">
        {receipt.status === "pending" || receipt.status === "processing" ? (
          <div className="flex flex-col items-center gap-2 rounded-card bg-white p-6 text-center shadow-card">
            <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
            <p className="text-sm text-muted">Procesando OCR…</p>
          </div>
        ) : receipt.status === "failed" ? (
          <div className="rounded-card bg-coral/10 p-4 text-sm text-coral">
            {receipt.errorMessage ?? "Error procesando el ticket."}
          </div>
        ) : null}

        {receipt.imageUrl && (
          <div className="overflow-hidden rounded-card bg-white shadow-card">
            {/* imagem via API — URL já com prefixo /uploads */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildImageUrl(receipt.imageUrl)}
              alt="Ticket"
              className="max-h-80 w-full object-cover"
            />
          </div>
        )}

        {receipt.total !== null && (
          <div className="flex items-center justify-between rounded-card bg-cesta-green p-4 text-white">
            <span className="text-sm opacity-80">Total</span>
            <span className="font-display text-2xl font-extrabold">
              {formatPrice(receipt.total)}
            </span>
          </div>
        )}

        {receipt.items.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Productos ({receipt.items.length})
            </h2>
            <ul className="space-y-2">
              {receipt.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-ink">
                      {item.productName ?? item.rawText}
                    </p>
                    <p className="text-xs text-muted">
                      {item.quantity} × {formatPrice(item.unitPrice)}
                      {!item.productId && (
                        <span className="ml-2 text-amber">· no identificado</span>
                      )}
                    </p>
                  </div>
                  <span className="font-bold text-cesta-green">
                    {formatPrice(item.total)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function buildImageUrl(imageUrl: string): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "") ?? "";
  return `${base}${imageUrl}`;
}
