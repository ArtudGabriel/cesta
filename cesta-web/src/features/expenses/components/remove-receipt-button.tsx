"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRemoveReceipt } from "../hooks/use-expenses";

export function RemoveReceiptButton({ receiptId }: { receiptId: string }) {
  const t = useTranslations("expenses.detail");
  const remove = useRemoveReceipt();
  const router = useRouter();

  function handleClick() {
    if (!confirm(t("confirmRemove"))) return;
    remove.mutate(receiptId, {
      onSuccess: () => router.push("/gastos"),
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={t("removeAria")}
      onClick={handleClick}
      disabled={remove.isPending}
    >
      <Trash2 className="h-5 w-5 text-coral" />
    </Button>
  );
}
