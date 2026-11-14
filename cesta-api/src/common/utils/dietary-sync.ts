// Sprint 65: bidirectional sync helpers entre User.prefers* e
// FamilyProfile.restrictions. 4 keys dietary primárias são "mirror"; o resto
// de `restrictions` (ex: valores do wizard que não mapeiam pra prefs) é
// preservado em merge.

export const DIETARY_KEYS = [
  'vegan',
  'vegetarian',
  'glutenFree',
  'lactoseFree',
] as const;

export type DietaryKey = (typeof DIETARY_KEYS)[number];

interface UserDietaryPrefs {
  prefersVegan: boolean;
  prefersVegetarian: boolean;
  prefersGlutenFree: boolean;
  prefersLactoseFree: boolean;
}

export function prefsToRestrictionsSet(prefs: UserDietaryPrefs): Set<DietaryKey> {
  const set = new Set<DietaryKey>();
  if (prefs.prefersVegan) set.add('vegan');
  if (prefs.prefersVegetarian) set.add('vegetarian');
  if (prefs.prefersGlutenFree) set.add('glutenFree');
  if (prefs.prefersLactoseFree) set.add('lactoseFree');
  return set;
}

export function restrictionsToPrefs(
  restrictions: string[],
): UserDietaryPrefs {
  const set = new Set(restrictions);
  return {
    prefersVegan: set.has('vegan'),
    prefersVegetarian: set.has('vegetarian'),
    prefersGlutenFree: set.has('glutenFree'),
    prefersLactoseFree: set.has('lactoseFree'),
  };
}

/**
 * Merge: preserva restrictions não-dietary (qualquer string fora de
 * DIETARY_KEYS) + sobrescreve as dietary primárias com o estado do set.
 */
export function mergeRestrictions(
  existing: string[],
  prefsSet: Set<DietaryKey>,
): string[] {
  const dietaryAsStrings = new Set<string>(DIETARY_KEYS);
  const nonDietary = existing.filter((r) => !dietaryAsStrings.has(r));
  return [...nonDietary, ...Array.from(prefsSet)];
}
