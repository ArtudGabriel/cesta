"use client";

import { ArrowLeft, Loader2, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateList,
  useLists,
} from "@/features/shopping-lists/hooks/use-shopping-lists";
import { formatPrice } from "@/lib/utils";

export default function MyListsPage() {
  const { data: lists, isLoading } = useLists();
  const createList = useCreateList();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const t = useTranslations("myList");
  const tNav = useTranslations("nav");

  return (
    <main className="flex-1 pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label={tNav("back")}>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-display text-xl font-bold text-ink">{t("title")}</h1>
      </header>

      <div className="px-4 py-4">
        {!creating ? (
          <Button className="w-full" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t("createNew")}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  createList.mutate(name.trim());
                }
                if (e.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
            />
            <Button
              onClick={() => createList.mutate(name.trim())}
              disabled={!name.trim() || createList.isPending}
            >
              {createList.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("createButton")
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="px-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-cesta-green" />
          </div>
        ) : !lists || lists.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted" />
            <p className="text-sm text-muted">{t("emptyLists")}</p>
            <p className="text-xs text-muted">{t("emptyListsHint")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/minha-lista/${list.id}`}
                  className="block rounded-card bg-white p-4 shadow-card transition-shadow hover:shadow-card-elevated"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-ink">
                        {list.name}
                      </h3>
                      <p className="text-xs text-muted">
                        {t("productsCount", { count: list.itemCount })}
                      </p>
                    </div>
                    {list.cheapestTotal !== null && (
                      <div className="text-right">
                        <p className="text-xs text-muted">{t("fromPrice")}</p>
                        <p className="text-lg font-bold text-cesta-green">
                          {formatPrice(list.cheapestTotal)}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
