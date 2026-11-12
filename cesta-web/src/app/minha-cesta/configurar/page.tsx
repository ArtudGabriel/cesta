"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

export default function ConfigurarCestaPage() {
  const user = useAuthStore((s) => s.user);
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

  useEffect(() => {
    if (profile.data) {
      setMembers({ ...INITIAL_MEMBERS, ...profile.data.members });
      setAnswers(profile.data.answers ?? {});
      setRestrictionsText(profile.data.restrictions.join(", "));
    }
  }, [profile.data]);

  const totalMembers = Object.values(members).reduce((a, b) => a + b, 0);

  async function handleFinish() {
    const restrictions = restrictionsText
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    await upsert.mutateAsync({ members, answers, restrictions });
    generate.mutate();
  }

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted">{t("configureLoginRequired")}</p>
        <Button asChild size="sm">
          <Link href="/login">{t("loginCta")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/minha-cesta">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-bold text-ink">{t("title")}</h1>
      </header>

      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={step >= 1 ? "font-bold text-cesta-green" : ""}>
            {t("wizardStep1")}
          </span>
          <span>›</span>
          <span className={step >= 2 ? "font-bold text-cesta-green" : ""}>
            {t("wizardStep2")}
          </span>
          <span>›</span>
          <span className={step >= 3 ? "font-bold text-cesta-green" : ""}>
            {t("wizardStep3")}
          </span>
        </div>
      </div>

      {step === 1 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted">{t("wizardMembersIntro")}</p>
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
          <p className="text-sm text-muted">{t("wizardHabitsIntro")}</p>
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
            <p className="mb-2 text-xs text-muted">{t("wizardRestrictionsHint")}</p>
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
