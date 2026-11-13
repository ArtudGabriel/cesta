"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cesta:recent-searches";
const MAX = 10;
const MIN_LENGTH = 2;

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

export function useRecentSearches(): UseRecentSearchesReturn {
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
