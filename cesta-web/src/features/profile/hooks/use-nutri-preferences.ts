"use client";

import { useCallback } from "react";
import { useProfile, useUpdateProfile } from "./use-profile";

export function useNutriPreferences(): {
  sortEnabled: boolean;
  healthyOnly: boolean;
  setSortEnabled: (next: boolean) => void;
  setHealthyOnly: (next: boolean) => void;
  isLoading: boolean;
} {
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();

  const sortEnabled = profile?.nutriSortEnabled ?? false;
  const healthyOnly = profile?.nutriHealthyOnly ?? false;

  const setSortEnabled = useCallback(
    (next: boolean) => {
      if (next === sortEnabled) return;
      update.mutate({ nutriSortEnabled: next });
    },
    [update, sortEnabled],
  );

  const setHealthyOnly = useCallback(
    (next: boolean) => {
      if (next === healthyOnly) return;
      update.mutate({ nutriHealthyOnly: next });
    },
    [update, healthyOnly],
  );

  return {
    sortEnabled,
    healthyOnly,
    setSortEnabled,
    setHealthyOnly,
    isLoading: isPending,
  };
}
