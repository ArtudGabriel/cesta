"use client";

import { useCallback, useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "./use-profile";
import type { SortUnitPreference } from "../types/profile.types";

/**
 * Sprint 175 fix — bug QA S174 nit: anon user click radio "Preço por unidade"
 * em /comparar → helper text "Mostrando preços totais" permanecia stale.
 *
 * Root cause: value lia só `profile?.sortUnitPreference ?? "absolute"`.
 * Pra anon user `useProfile` é disabled (enabled: isHydrated && Boolean(user)),
 * profile=undefined, value fixo "absolute" forever. setValue chamava
 * update.mutate, mas `useUpdateProfile.onMutate` checa `if (prev)` antes
 * de setQueryData — pra anon cache nunca existiu, update silencioso perdido.
 *
 * Novo contrato: source of truth é local state. Sync FROM profile só quando
 * logged user remount OR profile muda. setValue grava local instant + persist
 * backend async se logged (profile existe). Helper text passa a refletir
 * state corrente imediato, logged OR anon.
 */
export function useSortUnitPreference(): {
  value: SortUnitPreference;
  setValue: (next: SortUnitPreference) => void;
  isLoading: boolean;
} {
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();

  const [value, setLocal] = useState<SortUnitPreference>(
    profile?.sortUnitPreference ?? "absolute",
  );

  // Sync local ← profile quando mudar (login, refetch, etc).
  useEffect(() => {
    if (profile?.sortUnitPreference && profile.sortUnitPreference !== value) {
      setLocal(profile.sortUnitPreference);
    }
    // Intencional: não listar `value` nas deps — queremos sync UNI-direcional
    // (profile → local). Se listar value, infinite loop quando user alterna.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.sortUnitPreference]);

  const setValue = useCallback(
    (next: SortUnitPreference) => {
      if (next === value) return;
      setLocal(next);
      if (profile) {
        update.mutate({ sortUnitPreference: next });
      }
    },
    [update, value, profile],
  );

  return { value, setValue, isLoading: isPending };
}
