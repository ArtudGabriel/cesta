"use client";

import {
  Bell,
  ChevronRight,
  Heart,
  Leaf,
  List,
  Loader2,
  LogOut,
  MilkOff,
  Pencil,
  Receipt,
  Salad,
  ShoppingBasket,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { DisplayPreferencesSection } from "@/features/profile/components/display-preferences-section";
import {
  useProfile,
  useUpdateProfile,
} from "@/features/profile/hooks/use-profile";
import { useSyncDietary } from "@/features/profile/hooks/use-sync-dietary";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const LOCALE_OPTIONS: Array<{ value: "es" | "pt-BR"; label: string }> = [
  { value: "es", label: "Español" },
  { value: "pt-BR", label: "Português (BR)" },
];

type ShortcutKey =
  | "favorites"
  | "myList"
  | "expenses"
  | "alerts"
  | "familyBasket";

const SHORTCUTS: Array<{ key: ShortcutKey; href: string; icon: typeof Heart }> = [
  { key: "favorites", href: "/favoritos", icon: Heart },
  { key: "myList", href: "/minha-lista", icon: List },
  { key: "expenses", href: "/gastos", icon: Receipt },
  { key: "alerts", href: "/alertas", icon: Bell },
  { key: "familyBasket", href: "/minha-cesta", icon: ShoppingBasket },
];

export default function PerfilPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const clearSession = useAuthStore((s) => s.clear);
  const { data: profile, isError } = useProfile();
  const update = useUpdateProfile();
  const logout = useLogout();
  const t = useTranslations("profile");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace(`/login?returnUrl=${encodeURIComponent("/perfil")}`);
      return;
    }
    // user existe mas fetch /users/me falhou → sessão inválida (token expirado
    // sem refresh logic implementado). Limpa + redireciona.
    if (isError) {
      clearSession();
      router.replace(`/login?returnUrl=${encodeURIComponent("/perfil")}`);
    }
  }, [isHydrated, user, isError, router, clearSession]);

  if (!isHydrated || !user || !profile) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
      </main>
    );
  }

  const initials = getInitials(profile.name, profile.email ?? profile.phone);
  const contact = profile.email ?? profile.phone ?? "—";
  const since = new Date(profile.createdAt).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  function startEditName() {
    setNameDraft(profile?.name ?? "");
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === profile?.name) {
      setEditingName(false);
      return;
    }
    await update.mutateAsync({ name: trimmed });
    setEditingName(false);
  }

  function pickLocale(next: "es" | "pt-BR") {
    if (next === profile?.locale) return;
    document.cookie = `cesta:locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    update.mutate({ locale: next }, {
      onSuccess: () => router.refresh(),
    });
  }

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 bg-cream px-4 py-3">
        <h1 className="font-display text-lg font-bold text-ink">Mi cuenta</h1>
      </header>

      {/* Información */}
      <section className="px-4 pt-2">
        <div className="flex items-start gap-4 rounded-card bg-white p-4 shadow-sm">
          <div
            data-sentry-mask
            className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full bg-cesta-green text-xl font-bold text-white"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1" data-sentry-mask>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  maxLength={80}
                  className="h-10"
                />
                <Button
                  size="sm"
                  onClick={saveName}
                  disabled={update.isPending}
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingName(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-base font-bold text-ink">
                  {profile.name ?? "Sin nombre"}
                </p>
                <button
                  type="button"
                  onClick={startEditName}
                  aria-label="Editar nombre"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="truncate text-sm text-neutral-500">{contact}</p>
            <p className="mt-1 text-xs text-muted">Desde {since}</p>
          </div>
        </div>
      </section>

      {/* Preferencias */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Preferencias
        </h2>
        <div className="rounded-card bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-ink">Idioma</p>
          <div className="mt-3 flex gap-2">
            {LOCALE_OPTIONS.map((opt) => {
              const active = profile.locale === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pickLocale(opt.value)}
                  aria-pressed={active}
                  disabled={update.isPending}
                  className={cn(
                    "inline-flex h-11 flex-1 items-center justify-center rounded-pill border px-4 text-sm font-medium cursor-pointer transition-colors",
                    active
                      ? "border-cesta-green bg-cesta-green text-white"
                      : "border-neutral-200 text-ink hover:bg-surface",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">{t("localeHint")}</p>
        </div>
      </section>

      {/* Preferências dietéticas */}
      <DietarySection profile={profile} />

      {/* Preferências de visualização (Sprint 44) */}
      <DisplayPreferencesSection profile={profile} />

      {/* Atajos */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("shortcuts.title")}
        </h2>
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-card bg-white shadow-sm">
          {SHORTCUTS.map(({ key, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-[48px] items-center gap-3 px-4 py-3 text-sm font-medium text-ink hover:bg-surface"
              >
                <Icon className="h-5 w-5 text-muted" />
                <span className="flex-1">{t(`shortcuts.${key}`)}</span>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Cuenta */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("account.title")}
        </h2>
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-card bg-white shadow-sm">
          <li className="flex min-h-[48px] items-center gap-3 px-4 py-3 text-sm opacity-60">
            <span className="flex-1 text-ink">{t("account.changePassword")}</span>
            <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
              {t("account.comingSoon")}
            </span>
          </li>
          <li>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-60"
            >
              <LogOut className="h-5 w-5" />
              <span className="flex-1 text-left">{t("account.logout")}</span>
            </button>
          </li>
        </ul>
      </section>
    </main>
  );
}

type PrefKey =
  | "prefersVegan"
  | "prefersVegetarian"
  | "prefersGlutenFree"
  | "prefersLactoseFree";

type DietLabel = "vegan" | "vegetarian" | "glutenFree" | "lactoseFree";

const DIETARY_ROWS: Array<{ key: PrefKey; label: DietLabel; Icon: LucideIcon }> = [
  { key: "prefersVegan", label: "vegan", Icon: Leaf },
  { key: "prefersVegetarian", label: "vegetarian", Icon: Salad },
  { key: "prefersGlutenFree", label: "glutenFree", Icon: Wheat },
  { key: "prefersLactoseFree", label: "lactoseFree", Icon: MilkOff },
];

function DietarySection({
  profile,
}: {
  profile: {
    prefersVegan: boolean;
    prefersVegetarian: boolean;
    prefersGlutenFree: boolean;
    prefersLactoseFree: boolean;
  };
}) {
  const t = useTranslations("profile.dietary");
  const tSync = useTranslations("profile.syncDietary");
  const tDiet = useTranslations("product.dietary");
  const update = useUpdateProfile();
  const sync = useSyncDietary();
  const [pending, setPending] = useState<PrefKey | null>(null);

  const anyPrefActive =
    profile.prefersVegan ||
    profile.prefersVegetarian ||
    profile.prefersGlutenFree ||
    profile.prefersLactoseFree;

  async function toggle(key: PrefKey) {
    setPending(key);
    try {
      await update.mutateAsync({ [key]: !profile[key] });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="px-4 pt-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h2>
      <div className="rounded-card bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs text-muted">{t("subtitle")}</p>
        <ul className="divide-y divide-neutral-100">
          {DIETARY_ROWS.map(({ key, label, Icon }) => {
            const active = profile[key];
            const isPending = pending === key;
            return (
              <li key={key} className="flex items-center gap-3 py-3">
                <Icon className="h-5 w-5 text-muted" aria-hidden />
                <span className="flex-1 text-sm text-ink">{tDiet(label)}</span>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  disabled={isPending}
                  role="switch"
                  aria-checked={active}
                  className={cn(
                    "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60",
                    active ? "bg-cesta-green" : "bg-neutral-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                      active ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={!anyPrefActive || sync.isPending}
          className={cn(
            "mt-4 inline-flex h-11 w-full items-center justify-center rounded-pill border border-cesta-green px-4 text-sm font-medium text-cesta-green cursor-pointer transition-colors",
            "hover:bg-cesta-green hover:text-white",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-cesta-green",
          )}
        >
          {sync.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {tSync("button")}
        </button>
      </div>
    </section>
  );
}

function getInitials(name: string | null, fallback: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase();
  }
  if (fallback) return fallback.slice(0, 2).toUpperCase();
  return "U";
}

