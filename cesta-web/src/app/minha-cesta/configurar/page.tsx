"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

const MEMBER_LABELS: Array<{
  key: keyof FamilyMembers;
  label: string;
  hint: string;
}> = [
  { key: "babies", label: "Bebés", hint: "0 — 2 años" },
  { key: "kids", label: "Niños pequeños", hint: "3 — 6 años" },
  { key: "children", label: "Niños", hint: "7 — 12 años" },
  { key: "teens", label: "Adolescentes", hint: "13 — 17 años" },
  { key: "adults", label: "Adultos", hint: "18 — 59 años" },
  { key: "seniors", label: "Mayores", hint: "60+ años" },
];

export default function ConfigurarCestaPage() {
  const user = useAuthStore((s) => s.user);
  const locale = (user?.locale ?? "es") as "es" | "pt-BR";

  const questions = useDietaryQuestions();
  const profile = useFamilyProfile(Boolean(user));
  const upsert = useUpsertProfile();
  const generate = useGenerateBasket();

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
        <p className="text-sm text-muted">Inicia sesión para configurar tu cesta.</p>
        <Button asChild size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Volver">
          <Link href="/minha-cesta">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-bold text-ink">
          Mi Cesta familiar
        </h1>
      </header>

      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={step >= 1 ? "font-bold text-cesta-green" : ""}>
            1. Familia
          </span>
          <span>›</span>
          <span className={step >= 2 ? "font-bold text-cesta-green" : ""}>
            2. Hábitos
          </span>
          <span>›</span>
          <span className={step >= 3 ? "font-bold text-cesta-green" : ""}>
            3. Restricciones
          </span>
        </div>
      </div>

      {/* Step 1: membros */}
      {step === 1 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted">
            ¿Cuántas personas viven contigo? Separa por franja de edad.
          </p>
          {MEMBER_LABELS.map(({ key, label, hint }) => (
            <MemberCounter
              key={key}
              label={label}
              hint={hint}
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
              Siguiente
            </Button>
          </div>
        </section>
      )}

      {/* Step 2: perguntas */}
      {step === 2 && (
        <section className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted">Cuéntanos sobre los hábitos alimentarios.</p>
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
              Atrás
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Siguiente
            </Button>
          </div>
        </section>
      )}

      {/* Step 3: restrições */}
      {step === 3 && (
        <section className="space-y-3 px-4 py-4">
          <div className="rounded-card bg-white p-4 shadow-card">
            <Label htmlFor="restrictions">Restricciones (opcional)</Label>
            <p className="mb-2 text-xs text-muted">
              Palabras clave separadas por comas (ej: sin_palma, sin_azucar).
            </p>
            <Input
              id="restrictions"
              placeholder="sin_palma, sin_azucar"
              value={restrictionsText}
              onChange={(e) => setRestrictionsText(e.target.value)}
            />
          </div>

          <div className="sticky bottom-4 flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Atrás
            </Button>
            <Button
              className="flex-1"
              onClick={handleFinish}
              disabled={upsert.isPending || generate.isPending}
            >
              {(upsert.isPending || generate.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Generar cesta
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
