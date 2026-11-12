"use client";

import { useCallback } from "react";
import { useProfile, useUpdateProfile } from "./use-profile";
import type { SortUnitPreference } from "../types/profile.types";

export function useSortUnitPreference(): {
  value: SortUnitPreference;
  setValue: (next: SortUnitPreference) => void;
  isLoading: boolean;
} {
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();

  const value: SortUnitPreference = profile?.sortUnitPreference ?? "absolute";

  const setValue = useCallback(
    (next: SortUnitPreference) => {
      if (next === value) return;
      update.mutate({ sortUnitPreference: next });
    },
    [update, value],
  );

  return { value, setValue, isLoading: isPending };
}
