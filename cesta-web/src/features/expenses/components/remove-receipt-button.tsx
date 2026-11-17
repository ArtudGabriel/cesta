"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRemoveReceipt } from "../hooks/use-expenses";

export function RemoveReceiptButton({ receiptId }: { receiptId: string }) {
  const t = useTranslations("expenses.detail");
  const remove = useRemoveReceipt();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("removeAria")}
        onClick={() => setShowConfirm(true)}
        disabled={remove.isPending}
      >
        <Trash2 className="h-5 w-5 text-coral" />
      </Button>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          remove.mutate(receiptId, {
            onSuccess: () => router.push("/gastos"),
          });
        }}
        title={t("confirmRemove")}
        destructive
        isPending={remove.isPending}
      />
    </>
  );
}
