"use client";

import { useProfile } from "./use-profile";
import type { DietaryFlag } from "@/features/catalog/components/dietary-filters";

export function useDietaryPreferences(): Set<DietaryFlag> {
  const { data: profile } = useProfile();
  const set = new Set<DietaryFlag>();
  if (!profile) return set;
  if (profile.prefersVegan) set.add("vegan");
  if (profile.prefersVegetarian) set.add("vegetarian");
  if (profile.prefersGlutenFree) set.add("glutenFree");
  if (profile.prefersLactoseFree) set.add("lactoseFree");
  return set;
}
