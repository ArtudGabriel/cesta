"use client";

import { Bell, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
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

const TYPE_KEYS: Array<{ value: AlertType; key: string }> = [
  { value: "promotion", key: "promotion" },
  { value: "target_price", key: "targetPrice" },
  { value: "back_in_stock", key: "backInStock" },
  { value: "promotion_ending", key: "promotionEnding" },
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
  const t = useTranslations("alerts.create");

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
        {t("cta")}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-card bg-white sm:max-w-md sm:rounded-card">
            <header className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-display text-lg font-bold text-ink">
                {t("title")}
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("closeAria")}
                className="cursor-pointer rounded-btn p-1 hover:bg-surface"
              >
                <X className="h-5 w-5 text-ink" />
              </button>
            </header>

            <div className="space-y-3 p-4">
              <div>
                <Label>{t("typeLabel")}</Label>
                <div className="mt-2 space-y-2">
                  {TYPE_KEYS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`w-full rounded-btn border p-3 text-left cursor-pointer ${
                        type === opt.value
                          ? "border-cesta-green bg-cesta-green/5"
                          : "border-border bg-white"
                      }`}
                    >
                      <p className="text-sm font-medium text-ink">
                        {t(`types.${opt.key}.label`)}
                      </p>
                      <p className="text-xs text-muted">
                        {t(`types.${opt.key}.hint`)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {type === "target_price" && (
                <div>
                  <Label htmlFor="target">{t("targetLabel")}</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={t("targetPlaceholder")}
                  />
                </div>
              )}

              {supermarkets && supermarkets.length > 0 && (
                <div>
                  <Label htmlFor="market">{t("marketLabel")}</Label>
                  <select
                    id="market"
                    value={supermarketId}
                    onChange={(e) => setSupermarketId(e.target.value)}
                    className="flex h-12 w-full rounded-btn border border-border bg-white px-4 text-base text-ink focus:border-cesta-green focus:outline-none focus:ring-2 focus:ring-cesta-green/20"
                  >
                    <option value="">{t("anyMarket")}</option>
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
                {t("submit")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
