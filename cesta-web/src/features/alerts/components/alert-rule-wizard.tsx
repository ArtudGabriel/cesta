"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { useCreateAlertRule } from "@/features/alerts/hooks/use-alerts";
import type { AlertRuleType } from "@/features/alerts/types/alert.types";
import { ProductPicker } from "@/features/products/components/product-picker";
import type { ProductSearchItem } from "@/features/products/services/products.service";
import { translateError } from "@/lib/translate-error";

type WizardStep = "pick-type" | "configure";

const CUID_RE = /^c[a-z0-9]{24}$/;

export function AlertRuleWizard() {
  const t = useTranslations("alerts.rules");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<WizardStep>("pick-type");
  const [type, setType] = useState<AlertRuleType | null>(null);
  // trend usa productIdsInput (1 cuid cru, pattern S105 preservado); combo/
  // bundle migraram pra ProductPicker (S106) com estado multi-select.
  const [productIdsInput, setProductIdsInput] = useState("");
  const [pickedProducts, setPickedProducts] = useState<ProductSearchItem[]>([]);
  const [targetTotal, setTargetTotal] = useState("");
  const [consecutiveWeeks, setConsecutiveWeeks] = useState("2");
  const [targetSavings, setTargetSavings] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createRule = useCreateAlertRule({
    onSuccess: () => {
      router.push("/alertas");
    },
    onError: (err) => {
      setError(translateError(err, tErrors));
      // Scroll inline error into view — fold era vilão P2 S158.
      requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
  });
  const submitting = createRule.isPending;

  function pickType(t: AlertRuleType) {
    setType(t);
    setStep("configure");
    setError(null);
  }

  function parseProductIds(): string[] {
    return productIdsInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function validate(): string | null {
    if (!type) return t("errors.typeRequired");
    if (type === "trend") {
      const ids = parseProductIds();
      if (ids.length !== 1 || !CUID_RE.test(ids[0]))
        return t("errors.trendProductIdRequired");
      const weeks = Number(consecutiveWeeks);
      if (!Number.isInteger(weeks) || weeks < 2 || weeks > 12)
        return t("errors.weeksRange");
      return null;
    }
    // combo/bundle: ids vêm do ProductPicker (já validados CUID na origem).
    const ids = pickedProducts.map((p) => p.id);
    if (ids.length < 2) return t("errors.minTwoProducts");
    if (ids.length > 20) return t("errors.maxTwentyProducts");
    if (type === "combo") {
      const v = Number(targetTotal);
      if (!Number.isFinite(v) || v < 0.01) return t("errors.targetTotalRange");
    }
    if (type === "bundle") {
      const v = Number(targetSavings);
      if (!Number.isFinite(v) || v < 0.01)
        return t("errors.targetSavingsRange");
    }
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    setError(null);
    const ids =
      type === "trend" ? parseProductIds() : pickedProducts.map((p) => p.id);
    if (type === "combo") {
      createRule.mutate({
        type: "combo",
        payload: { productIds: ids, targetTotal: Number(targetTotal) },
      });
    } else if (type === "trend") {
      createRule.mutate({
        type: "trend",
        payload: {
          productId: ids[0],
          consecutiveWeeks: Number(consecutiveWeeks),
        },
      });
    } else if (type === "bundle") {
      createRule.mutate({
        type: "bundle",
        payload: { productIds: ids, targetSavings: Number(targetSavings) },
      });
    }
  }

  if (step === "pick-type") {
    return (
      <div
        className="flex flex-col gap-3"
        data-testid="rule-wizard-type-picker"
      >
        <h2 className="text-lg font-semibold">{t("typePickerTitle")}</h2>
        <div className="grid gap-2">
          {/* Sprint 228 #17: trend primeiro (default · 1 produto · queda %)
              porque user maioria quer monitorar preço de UM item. Combo +
              bundle são secundários (2+ produtos). */}
          {(["trend", "combo", "bundle"] as const).map((rt) => (
            <button
              key={rt}
              type="button"
              className="rounded-lg border p-4 text-left hover:bg-muted"
              onClick={() => pickType(rt)}
              data-testid={`rule-type-${rt}`}
            >
              <div className="font-medium">{t(`types.${rt}.label`)}</div>
              <div className="text-sm text-muted-foreground">
                {t(`types.${rt}.description`)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4"
      data-testid="rule-wizard-form"
      data-sentry-mask
    >
      <div className="text-sm text-muted-foreground">
        {t(`types.${type}.label`)}
      </div>

      {type === "trend" ? (
        <>
          <div>
            <Label htmlFor="productId">{t("fields.productId")}</Label>
            <Input
              id="productId"
              value={productIdsInput}
              onChange={(e) => setProductIdsInput(e.target.value)}
              placeholder="c…"
              autoComplete="off"
              data-testid="rule-input-product-ids"
            />
          </div>
          <div>
            <Label htmlFor="weeks">{t("fields.consecutiveWeeks")}</Label>
            <Input
              id="weeks"
              type="number"
              min={2}
              max={12}
              step={1}
              value={consecutiveWeeks}
              onChange={(e) => setConsecutiveWeeks(e.target.value)}
              data-testid="rule-input-weeks"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>{t("fields.productIds")}</Label>
            <ProductPicker
              value={pickedProducts}
              onChange={setPickedProducts}
              max={20}
              data-testid="rule-input-product-ids"
            />
          </div>
          {type === "combo" && (
            <div>
              <Label htmlFor="targetTotal">{t("fields.targetTotal")}</Label>
              <Input
                id="targetTotal"
                type="number"
                min={0.01}
                step={0.01}
                value={targetTotal}
                onChange={(e) => setTargetTotal(e.target.value)}
                placeholder="0.00"
                data-testid="rule-input-target-total"
              />
            </div>
          )}
          {type === "bundle" && (
            <div>
              <Label htmlFor="targetSavings">
                {t("fields.targetSavings")}
              </Label>
              <Input
                id="targetSavings"
                type="number"
                min={0.01}
                step={0.01}
                value={targetSavings}
                onChange={(e) => setTargetSavings(e.target.value)}
                placeholder="0.00"
                data-testid="rule-input-target-savings"
              />
            </div>
          )}
        </>
      )}

      <div ref={errorRef} data-testid="rule-wizard-error">
        {error && <FieldError message={error} />}
      </div>

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep("pick-type")}
          disabled={submitting}
        >
          {t("backCta")}
        </Button>
        <Button type="submit" disabled={submitting} data-testid="rule-submit">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("submitCta")}
        </Button>
      </div>
    </form>
  );
}
