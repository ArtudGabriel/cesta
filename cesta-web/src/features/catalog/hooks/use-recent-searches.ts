"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { searchHistoryService } from "../services/search-history.service";

const STORAGE_KEY = "cesta:recent-searches";
const MAX = 10;
const MIN_LENGTH = 2;
const QUERY_KEY = ["search-history"] as const;

function readStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

// Flag module-level pra não repetir warning (quota cheia = tende a disparar
// a cada add). Primeira ocorrência console.warn, resto silencioso.
let quotaWarned = false;

function writeStorage(items: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    if (!quotaWarned) {
      quotaWarned = true;
      console.warn(
        "[cesta] localStorage write failed (quota or disabled). Recent searches won't persist.",
        err,
      );
    }
  }
}

export interface UseRecentSearchesReturn {
  recents: string[];
  add: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
}

/**
 * Logado: sync backend via React Query.
 * Deslogado: localStorage (Sprint 25 pattern preservado).
 *
 * Ambos sub-hooks sempre chamados pra respeitar Rules of Hooks — cada um
 * recebe `enabled` e no-op quando inativo. API retornada muda só no return.
 */
export function useRecentSearches(): UseRecentSearchesReturn {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const logged = isHydrated && Boolean(user);

  const backend = useBackendRecents({ enabled: logged });
  const local = useLocalRecents({ enabled: !logged });

  return logged ? backend : local;
}

function useLocalRecents({ enabled }: { enabled: boolean }): UseRecentSearchesReturn {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRecents([]);
      return;
    }
    setRecents(readStorage());
  }, [enabled]);

  const add = useCallback(
    (q: string) => {
      if (!enabled) return;
      const normalized = q.trim();
      if (normalized.length < MIN_LENGTH) return;
      setRecents((prev) => {
        const lower = normalized.toLowerCase();
        const filtered = prev.filter((v) => v.toLowerCase() !== lower);
        const next = [normalized, ...filtered].slice(0, MAX);
        writeStorage(next);
        return next;
      });
    },
    [enabled],
  );

  const remove = useCallback(
    (q: string) => {
      if (!enabled) return;
      setRecents((prev) => {
        const lower = q.toLowerCase();
        const next = prev.filter((v) => v.toLowerCase() !== lower);
        writeStorage(next);
        return next;
      });
    },
    [enabled],
  );

  const clear = useCallback(() => {
    if (!enabled) return;
    writeStorage([]);
    setRecents([]);
  }, [enabled]);

  return { recents, add, remove, clear };
}

function useBackendRecents({
  enabled,
}: {
  enabled: boolean;
}): UseRecentSearchesReturn {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: searchHistoryService.list,
    staleTime: 60 * 1000,
    enabled,
  });

  const addMutation = useMutation({
    mutationFn: (q: string) => searchHistoryService.add(q),
    onMutate: async (q) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<{ query: string }[]>(QUERY_KEY);
      qc.setQueryData<{ id: string; query: string; createdAt: string }[]>(
        QUERY_KEY,
        (old) => {
          const base = Array.isArray(old) ? old : [];
          const lower = q.toLowerCase();
          const filtered = base.filter((i) => i.query.toLowerCase() !== lower);
          return [
            { id: `optimistic-${q}`, query: q, createdAt: new Date().toISOString() },
            ...filtered,
          ].slice(0, MAX);
        },
      );
      return { prev };
    },
    onError: (_err, _q, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (q: string) => searchHistoryService.remove(q),
    onMutate: async (q) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<{ query: string }[]>(QUERY_KEY);
      qc.setQueryData<{ query: string }[]>(QUERY_KEY, (old) => {
        if (!Array.isArray(old)) return old;
        const lower = q.toLowerCase();
        return old.filter((i) => i.query.toLowerCase() !== lower);
      });
      return { prev };
    },
    onError: (_err, _q, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const clearMutation = useMutation({
    mutationFn: () => searchHistoryService.clear(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const recents = enabled ? (data ?? []).map((i) => i.query) : [];

  const add = useCallback(
    (q: string) => {
      if (!enabled) return;
      const normalized = q.trim();
      if (normalized.length < MIN_LENGTH) return;
      addMutation.mutate(normalized);
    },
    [enabled, addMutation],
  );

  const remove = useCallback(
    (q: string) => {
      if (!enabled) return;
      removeMutation.mutate(q);
    },
    [enabled, removeMutation],
  );

  const clear = useCallback(() => {
    if (!enabled) return;
    clearMutation.mutate();
  }, [enabled, clearMutation]);

  return { recents, add, remove, clear };
}
