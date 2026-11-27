"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sprint 239 (#12): seleção de produtos a comparar passa a viver num store
// persistido em localStorage. Antes o estado só existia na URL (/comparar
// ?products=a,b,c): sair da rota (ex: nova busca no home) zerava a seleção.
// Store é fonte de verdade entre rotas; URL permanece como canal de
// deep-link e sincroniza bidirecional (URL vence no boot quando preenchida,
// senão hidrata da storage).

export const COMPARE_MAX = 4;
const STORAGE_KEY = "cesta-compare-v1";

interface CompareState {
  ids: string[];
  isHydrated: boolean;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  toggle: (productId: string) => void;
  setIds: (ids: string[]) => void;
  clear: () => void;
}

function dedupeCap(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= COMPARE_MAX) break;
  }
  return out;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      isHydrated: false,
      add: (productId) => {
        const current = get().ids;
        if (current.includes(productId)) return;
        if (current.length >= COMPARE_MAX) return;
        set({ ids: [...current, productId] });
      },
      remove: (productId) => {
        set({ ids: get().ids.filter((id) => id !== productId) });
      },
      toggle: (productId) => {
        const current = get().ids;
        if (current.includes(productId)) {
          set({ ids: current.filter((id) => id !== productId) });
        } else {
          if (current.length >= COMPARE_MAX) return;
          set({ ids: [...current, productId] });
        }
      },
      setIds: (next) => set({ ids: dedupeCap(next) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ ids: state.ids }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
