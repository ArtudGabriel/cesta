"use client";

import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddProductModal } from "@/features/shopping-lists/components/add-product-modal";
import { ListItemRow } from "@/features/shopping-lists/components/list-item-row";
import { TotalsByMarket } from "@/features/shopping-lists/components/totals-by-market";
import {
  useDeleteList,
  useList,
  useListTotals,
} from "@/features/shopping-lists/hooks/use-shopping-lists";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;

  const { data: list, isLoading } = useList(listId);
  const { data: totals } = useListTotals(listId);
  const deleteList = useDeleteList();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  if (!list) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-coral">Lista no encontrada.</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/minha-lista">Volver</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/minha-lista">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="line-clamp-1 flex-1 font-display text-lg font-bold text-ink">
          {list.name}
        </h1>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Eliminar lista"
          onClick={() => {
            if (confirm("¿Eliminar esta lista?")) {
              deleteList.mutate(list.id);
            }
          }}
        >
          <Trash2 className="h-5 w-5 text-coral" />
        </Button>
      </header>

      <div className="px-4 py-2">
        <Button className="w-full" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Agregar producto
        </Button>
      </div>

      <section className="px-4 py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Productos ({list.items?.length ?? 0})
        </h2>
        {list.items && list.items.length > 0 ? (
          <div className="space-y-2">
            {list.items.map((item) => (
              <ListItemRow key={item.id} listId={list.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            Agrega productos para comparar precios entre supermercados.
          </p>
        )}
      </section>

      {totals && list.items && list.items.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Total por supermercado
          </h2>
          <TotalsByMarket totals={totals} />
        </section>
      )}

      <AddProductModal
        listId={list.id}
        open={showAdd}
        onClose={() => setShowAdd(false)}
      />
    </main>
  );
}
