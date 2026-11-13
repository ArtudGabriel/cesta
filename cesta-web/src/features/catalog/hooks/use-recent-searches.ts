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
 * API idêntica — consumers agnósticos da fonte.
 */
export function useRecentSearches(): UseRecentSearchesReturn {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const logged = isHydrated && Boolean(user);
  return logged ? useBackendRecents() : useLocalRecents();
}

function useLocalRecents(): UseRecentSearchesReturn {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setRecents(readStorage());
  }, []);

  const add = useCallback((q: string) => {
    const normalized = q.trim();
    if (normalized.length < MIN_LENGTH) return;
    setRecents((prev) => {
      const lower = normalized.toLowerCase();
      const filtered = prev.filter((v) => v.toLowerCase() !== lower);
      const next = [normalized, ...filtered].slice(0, MAX);
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setRecents((prev) => {
      const lower = q.toLowerCase();
      const next = prev.filter((v) => v.toLowerCase() !== lower);
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeStorage([]);
    setRecents([]);
  }, []);

  return { recents, add, remove, clear };
}

function useBackendRecents(): UseRecentSearchesReturn {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: searchHistoryService.list,
    staleTime: 60 * 1000,
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

  const recents = (data ?? []).map((i) => i.query);

  const add = useCallback(
    (q: string) => {
      const normalized = q.trim();
      if (normalized.length < MIN_LENGTH) return;
      addMutation.mutate(normalized);
    },
    [addMutation],
  );

  const remove = useCallback(
    (q: string) => {
      removeMutation.mutate(q);
    },
    [removeMutation],
  );

  const clear = useCallback(() => {
    clearMutation.mutate();
  }, [clearMutation]);

  return { recents, add, remove, clear };
}
