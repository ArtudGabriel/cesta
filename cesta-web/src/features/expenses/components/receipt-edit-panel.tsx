"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import {
  useAddReceiptItem,
  useRemoveReceiptItem,
  useUpdateReceipt,
  useUpdateReceiptItem,
} from "../hooks/use-expenses";
import type { Receipt, ReceiptItem } from "../types/expense.types";

interface ReceiptEditPanelProps {
  receipt: Receipt;
}

export function ReceiptEditPanel({ receipt }: ReceiptEditPanelProps) {
  const t = useTranslations("expenses.edit");
  const updateReceipt = useUpdateReceipt(receipt.id);
  const updateItem = useUpdateReceiptItem(receipt.id);
  const removeItem = useRemoveReceiptItem(receipt.id);
  const addItem = useAddReceiptItem(receipt.id);
  const [editingItem, setEditingItem] = useState<ReceiptItem | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="space-y-4" data-sentry-mask>
      <MetadataForm receipt={receipt} onSave={updateReceipt.mutate} />

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("itemsHeading", { count: receipt.items.length })}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAdding(true)}
            aria-label={t("addItem")}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1 text-xs">{t("addItem")}</span>
          </Button>
        </header>
        <ul className="space-y-2">
          {receipt.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setEditingItem(item)}
                aria-label={t("editItem")}
              >
                <p className="line-clamp-2 text-sm font-medium text-ink">
                  {item.productName ?? item.rawText}
                </p>
                <p className="text-xs text-muted">
                  {item.quantity} × {formatPrice(item.unitPrice)}
                </p>
              </button>
              <span className="font-bold text-cesta-green">
                {formatPrice(item.total)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditingItem(item)}
                aria-label={t("editItem")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeItem.mutate(item.id)}
                disabled={removeItem.isPending}
                aria-label={t("removeItem")}
              >
                <Trash2 className="h-4 w-4 text-coral" />
              </Button>
            </li>
          ))}
          {receipt.items.length === 0 && (
            <li className="rounded-card bg-white p-4 text-center text-sm text-muted shadow-card">
              {t("noItems")}
            </li>
          )}
        </ul>
      </section>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          saving={updateItem.isPending}
          onClose={() => setEditingItem(null)}
          onSave={(payload) =>
            updateItem.mutate(
              { itemId: editingItem.id, payload },
              { onSuccess: () => setEditingItem(null) },
            )
          }
        />
      )}
      {adding && (
        <AddItemModal
          saving={addItem.isPending}
          onClose={() => setAdding(false)}
          onSave={(payload) =>
            addItem.mutate(payload, { onSuccess: () => setAdding(false) })
          }
        />
      )}
    </section>
  );
}

interface MetadataFormProps {
  receipt: Receipt;
  onSave: (payload: {
    supermarketSlug?: string | null;
    purchaseDate?: string | null;
    total?: number | null;
  }) => void;
}

function MetadataForm({ receipt, onSave }: MetadataFormProps) {
  const t = useTranslations("expenses.edit");
  const totalId = useId();
  const slugId = useId();
  const dateId = useId();
  const [total, setTotal] = useState(receipt.total?.toString() ?? "");
  const [slug, setSlug] = useState(receipt.supermarketSlug ?? "");
  const [date, setDate] = useState(
    receipt.purchaseDate ? receipt.purchaseDate.slice(0, 10) : "",
  );

  const handleSave = () => {
    const payload: {
      supermarketSlug?: string | null;
      purchaseDate?: string | null;
      total?: number | null;
    } = {};
    const parsedTotal = total.trim() ? Number(total) : null;
    if (parsedTotal !== receipt.total) payload.total = parsedTotal;
    const nextSlug = slug.trim() || null;
    if (nextSlug !== receipt.supermarketSlug) payload.supermarketSlug = nextSlug;
    const nextDate = date ? new Date(date).toISOString() : null;
    if (nextDate !== receipt.purchaseDate) payload.purchaseDate = nextDate;
    if (Object.keys(payload).length === 0) return;
    onSave(payload);
  };

  return (
    <div className="space-y-3 rounded-card bg-white p-4 shadow-card">
      <div className="space-y-1">
        <Label htmlFor={totalId}>{t("total")}</Label>
        <Input
          id={totalId}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={total}
          onChange={(event) => setTotal(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={slugId}>{t("supermarket")}</Label>
        <Input
          id={slugId}
          type="text"
          placeholder="mercadona"
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={dateId}>{t("date")}</Label>
        <Input
          id={dateId}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <Button className="w-full" onClick={handleSave}>
        {t("save")}
      </Button>
    </div>
  );
}

interface ItemModalPayload {
  rawText: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number;
}

function EditItemModal({
  item,
  saving,
  onClose,
  onSave,
}: {
  item: ReceiptItem;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    quantity?: number;
    unitPrice?: number;
  }) => void;
}) {
  const t = useTranslations("expenses.edit");
  const [qty, setQty] = useState(item.quantity.toString());
  const [unit, setUnit] = useState(item.unitPrice.toString());

  return (
    <ModalShell title={t("editItem")} onClose={onClose}>
      <NumberField label={t("quantity")} value={qty} onChange={setQty} step="0.001" />
      <NumberField label={t("unitPrice")} value={unit} onChange={setUnit} step="0.01" />
      <Button
        className="w-full"
        disabled={saving}
        onClick={() =>
          onSave({
            quantity: Number(qty),
            unitPrice: Number(unit),
          })
        }
      >
        {t("save")}
      </Button>
    </ModalShell>
  );
}

function AddItemModal({
  saving,
  onClose,
  onSave,
}: {
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ItemModalPayload) => void;
}) {
  const t = useTranslations("expenses.edit");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("0");

  const canSave = name.trim() && Number(qty) > 0 && Number(unit) >= 0;

  return (
    <ModalShell title={t("addItem")} onClose={onClose}>
      <div className="space-y-1">
        <Label>{t("name")}</Label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
        />
      </div>
      <NumberField label={t("quantity")} value={qty} onChange={setQty} step="0.001" />
      <NumberField label={t("unitPrice")} value={unit} onChange={setUnit} step="0.01" />
      <Button
        className="w-full"
        disabled={!canSave || saving}
        onClick={() =>
          onSave({
            rawText: name,
            normalizedName: name.trim().toLowerCase(),
            quantity: Number(qty),
            unitPrice: Number(unit),
          })
        }
      >
        {t("save")}
      </Button>
    </ModalShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  step: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end bg-ink/50 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full space-y-3 rounded-t-card bg-white p-5 shadow-card sm:max-w-sm sm:rounded-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="close">
            <X className="h-4 w-4" />
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}
