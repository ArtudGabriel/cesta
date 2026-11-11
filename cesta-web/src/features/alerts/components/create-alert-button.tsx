"use client";

import { Bell, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Supermarket } from "@/features/catalog/types/catalog.types";
import { useCreateAlert } from "../hooks/use-alerts";
import type { AlertType } from "../types/alert.types";

interface CreateAlertButtonProps {
  productId: string;
  supermarkets?: Supermarket[];
}

const TYPES: Array<{ value: AlertType; label: string; hint: string }> = [
  { value: "promotion", label: "En promoción", hint: "Cuando entre en oferta" },
  { value: "target_price", label: "Precio objetivo", hint: "Cuando baje de X €" },
  { value: "back_in_stock", label: "Vuelve a stock", hint: "Cuando esté disponible" },
  {
    value: "promotion_ending",
    label: "Promoción terminando",
    hint: "Cuando esté por acabar",
  },
];

export function CreateAlertButton({
  productId,
  supermarkets,
}: CreateAlertButtonProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AlertType>("promotion");
  const [targetPrice, setTargetPrice] = useState("");
  const [supermarketId, setSupermarketId] = useState<string>("");
  const create = useCreateAlert();

  async function submit() {
    await create.mutateAsync({
      productId,
      type,
      targetPrice: type === "target_price" ? parseFloat(targetPrice) : undefined,
      supermarketId: supermarketId || undefined,
    });
    setOpen(false);
    setTargetPrice("");
    setSupermarketId("");
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Bell className="h-4 w-4" />
        Crear alerta
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-card bg-white sm:max-w-md sm:rounded-card">
            <header className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-display text-lg font-bold text-ink">
                Nueva alerta
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-btn p-1 hover:bg-surface"
              >
                <X className="h-5 w-5 text-ink" />
              </button>
            </header>

            <div className="space-y-3 p-4">
              <div>
                <Label>Tipo de alerta</Label>
                <div className="mt-2 space-y-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`w-full rounded-btn border p-3 text-left cursor-pointer ${
                        type === t.value
                          ? "border-cesta-green bg-cesta-green/5"
                          : "border-border bg-white"
                      }`}
                    >
                      <p className="text-sm font-medium text-ink">{t.label}</p>
                      <p className="text-xs text-muted">{t.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {type === "target_price" && (
                <div>
                  <Label htmlFor="target">Precio objetivo (€)</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="1.50"
                  />
                </div>
              )}

              {supermarkets && supermarkets.length > 0 && (
                <div>
                  <Label htmlFor="market">Supermercado (opcional)</Label>
                  <select
                    id="market"
                    value={supermarketId}
                    onChange={(e) => setSupermarketId(e.target.value)}
                    className="flex h-12 w-full rounded-btn border border-border bg-white px-4 text-base text-ink focus:border-cesta-green focus:outline-none focus:ring-2 focus:ring-cesta-green/20"
                  >
                    <option value="">Cualquiera</option>
                    {supermarkets.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                className="w-full"
                onClick={submit}
                disabled={
                  create.isPending ||
                  (type === "target_price" && !parseFloat(targetPrice))
                }
              >
                {create.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Crear alerta
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
