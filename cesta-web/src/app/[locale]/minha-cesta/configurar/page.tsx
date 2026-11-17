"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberCounter } from "@/features/family-basket/components/member-counter";
import { QuestionCard } from "@/features/family-basket/components/question-card";
import {
  useDietaryQuestions,
  useFamilyProfile,
  useGenerateBasket,
  useUpsertProfile,
} from "@/features/family-basket/hooks/use-family-basket";
import type { FamilyMembers } from "@/features/family-basket/types/family-basket.types";
import { useAuthStore } from "@/stores/auth.store";

const INITIAL_MEMBERS: FamilyMembers = {
  babies: 0,
  kids: 0,
  children: 0,
  teens: 0,
  adults: 1,
  seniors: 0,
};

const MEMBER_KEYS: Array<{
  key: keyof FamilyMembers;
  labelKey: "memberBabies" | "memberKids" | "memberChildren" | "memberTeens" | "memberAdults" | "memberSeniors";
  hintKey: "memberBabiesHint" | "memberKidsHint" | "memberChildrenHint" | "memberTeensHint" | "memberAdultsHint" | "memberSeniorsHint";
}> = [
  { key: "babies", labelKey: "memberBabies", hintKey: "memberBabiesHint" },
  { key: "kids", labelKey: "memberKids", hintKey: "memberKidsHint" },
  { key: "children", labelKey: "memberChildren", hintKey: "memberChildrenHint" },
  { key: "teens", labelKey: "memberTeens", hintKey: "memberTeensHint" },
  { key: "adults", labelKey: "memberAdults", hintKey: "memberAdultsHint" },
  { key: "seniors", labelKey: "memberSeniors", hintKey: "memberSeniorsHint" },
];

const STEP_LABELS = [
  "wizardStep1",
  "wizardStep2",
  "wizardStep3",
  "wizardStep4",
  "wizardStep5",
] as const;

const WizardSchema = z.object({
  members: z.object({
    babies: z.number().int().min(0),
    kids: z.number().int().min(0),
    children: z.number().int().min(0),
    teens: z.number().int().min(0),
    adults: z.number().int().min(0),
    seniors: z.number().int().min(0),
  }),
  answers: z.record(z.string(), z.union([z.boolean(), z.string()])),
  restrictions: z.array(z.string()),
  monthlyBudget: z.number().min(0).nullable(),
});

type WizardData = {
  members: {
    babies: number;
    kids: number;
    children: number;
    teens: number;
    adults: number;
    seniors: number;
  };
  answers: Record<string, boolean | string>;
  restrictions: string[];
  monthlyBudget: number | null;
};

export default function ConfigurarCestaPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const router = useRouter();
  const locale = (user?.locale ?? "es") as "es" | "pt-BR";

  const questions = useDietaryQuestions();
  const profile = useFamilyProfile(Boolean(user));
  const upsert = useUpsertProfile();
  const generate = useGenerateBasket();
  const t = useTranslations("familyBasket");
  const tNav = useTranslations("nav");

  const [step, setStep] = useState(1);
  const [members, setMembers] = useState<FamilyMembers>(INITIAL_MEMBERS);
  const [answers, setAnswers] = useState<Record<string, boolean | string>>({});
  const [restrictionsText, setRestrictionsText] = useState("");
  const [budgetText, setBudgetText] = useState("");

  // Prefill wizard com dados remotos do profile uma vez após fetch — padrão de
  // hidratação de form controlado a partir de React Query. React 19 reclama
  // via react-hooks/set-state-in-effect; aqui é intencional (server→form).
  useEffect(() => {
    if (!profile.data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMembers({ ...INITIAL_MEMBERS, ...profile.data.members });
    setAnswers(profile.data.answers ?? {});
    setRestrictionsText(profile.data.restrictions.join(", "));
    setBudgetText(
      profile.data.monthlyBudget != null
        ? String(profile.data.monthlyBudget)
        : "",
    );
  }, [profile.data]);

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace(
        `/login?returnUrl=${encodeURIComponent("/minha-cesta/configurar")}`,
      );
    }
  }, [isHydrated, user, router]);

  const totalMembers = Object.values(members).reduce((a, b) => a + b, 0);

  const restrictionsArray = useMemo(
    () =>
      restrictionsText
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
    [restrictionsText],
  );

  const parsedBudget = useMemo(() => {
    if (!budgetText.trim()) return null;
    const n = Number(budgetText.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [budgetText]);

  async function handleFinish() {
    const payload: WizardData = {
      members,
      answers,
      restrictions: restrictionsArray,
      monthlyBudget: parsedBudget,
    };
    const parsed = WizardSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Dados inválidos");
      return;
    }

    await upsert.mutateAsync(payload);
    // useGenerateBasket.onSuccess já redireciona pra /minha-cesta.
    await generate.mutateAsync();
  }

  if (!isHydrated || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  return (
    // Sprint 59 GDPR: wizard inteiro masked — composição familiar (member counts)
    // + restrições dietéticas + orçamento = PII sensível (saúde Art. 9 GDPR +
    // financeira). Labels i18n dos steps são chrome; valores escolhidos = PII.
    <main className="flex-1 pb-24" data-sentry-mask>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3"
        data-sentry-unmask
      >
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/minha-cesta">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-bold text-ink">{t("title")}</h1>
      </header>

      <div className="px-4 py-2" data-sentry-unmask>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {STEP_LABELS.map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className={
                  step >= i + 1 ? "font-bold text-cesta-green" : undefined
                }
              >
                {t(label)}
              </span>
              {i < STEP_LABELS.length - 1 && <span>›</span>}
            </span>
          ))}
        </div>
      </div>

      {step === 1 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted" data-sentry-unmask>
            {t("wizardMembersIntro")}
          </p>
          {MEMBER_KEYS.map(({ key, labelKey, hintKey }) => (
            <MemberCounter
              key={key}
              label={t(labelKey)}
              hint={t(hintKey)}
              value={members[key]}
              onChange={(v) => setMembers((m) => ({ ...m, [key]: v }))}
            />
          ))}

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={totalMembers === 0}
            >
              {t("wizardNext")}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted" data-sentry-unmask>
            {t("wizardHabitsIntro")}
          </p>
          {questions.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
            </div>
          ) : (
            (questions.data ?? []).map((q) => (
              <QuestionCard
                key={q.key}
                question={q}
                locale={locale}
                value={answers[q.key]}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
              />
            ))
          )}

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t("wizardBack")}
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              {t("wizardNext")}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3 px-4 py-4">
          <div className="rounded-card bg-white p-4 shadow-card">
            <Label htmlFor="restrictions">{t("wizardRestrictionsLabel")}</Label>
            <p className="mb-2 text-xs text-muted" data-sentry-unmask>
              {t("wizardRestrictionsHint")}
            </p>
            <Input
              id="restrictions"
              placeholder={t("wizardRestrictionsPlaceholder")}
              value={restrictionsText}
              onChange={(e) => setRestrictionsText(e.target.value)}
            />
          </div>

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              {t("wizardBack")}
            </Button>
            <Button className="flex-1" onClick={() => setStep(4)}>
              {t("wizardNext")}
            </Button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted" data-sentry-unmask>
            {t("wizardBudgetIntro")}
          </p>
          <div className="rounded-card bg-white p-4 shadow-card">
            <Label htmlFor="budget">{t("wizardBudgetLabel")}</Label>
            <p className="mb-2 text-xs text-muted" data-sentry-unmask>
              {t("wizardBudgetHint")}
            </p>
            <Input
              id="budget"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={t("wizardBudgetPlaceholder")}
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
            />
          </div>

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(3)}>
              {t("wizardBack")}
            </Button>
            <Button className="flex-1" onClick={() => setStep(5)}>
              {t("wizardNext")}
            </Button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted" data-sentry-unmask>
            {t("wizardReviewIntro")}
          </p>

          <ReviewRow
            label={t("wizardReviewMembers")}
            value={`${totalMembers}`}
          />
          <ReviewRow
            label={t("wizardReviewAnswers")}
            value={`${Object.keys(answers).length}`}
          />
          <ReviewRow
            label={t("wizardReviewRestrictions")}
            value={
              restrictionsArray.length > 0
                ? restrictionsArray.join(", ")
                : t("wizardReviewNone")
            }
          />
          <ReviewRow
            label={t("wizardReviewBudget")}
            value={
              parsedBudget != null
                ? `€${parsedBudget.toFixed(2)}`
                : t("wizardReviewNoBudget")
            }
          />

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(4)}>
              {t("wizardBack")}
            </Button>
            <Button
              className="flex-1"
              onClick={handleFinish}
              disabled={upsert.isPending || generate.isPending}
            >
              {(upsert.isPending || generate.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("wizardSubmit")}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between rounded-card bg-white p-3 shadow-card">
      <span className="text-xs text-muted" data-sentry-unmask>
        {label}
      </span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}
