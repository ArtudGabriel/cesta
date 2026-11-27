"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/features/catalog/components/product-image";
import { useProducts } from "@/features/catalog/hooks/use-catalog";
import { formatPrice } from "@/lib/utils";
import { useAddItem, useList } from "../hooks/use-shopping-lists";

interface AddProductModalProps {
  listId: string;
  open: boolean;
  onClose: () => void;
}

export function AddProductModal({ listId, open, onClose }: AddProductModalProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({
    search: search || undefined,
    limit: 15,
  });
  const addItem = useAddItem(listId);
  const router = useRouter();
  const t = useTranslations("myList");
  // Sprint 242 (#5): lê nome da lista pro toast "X adicionado a Y".
  // useList já está no cache (ListDetailClient hidrata), zero request extra.
  const { data: listData } = useList(listId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-h-[85vh] overflow-hidden rounded-t-card bg-white sm:max-w-md sm:rounded-card">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-display text-lg font-bold text-ink">
            {t("addProduct")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("closeModal")}
            className="cursor-pointer rounded-btn p-1 hover:bg-surface"
          >
            <X className="h-5 w-5 text-ink" />
          </button>
        </header>

        <div className="p-4">
          <Input
            autoFocus
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Sprint 227 (#7 bundle 2): iOS Safari autocapitaliza primeira
            // letra por default — quebra busca case-sensitive do user. Força
            // lowercase + desliga autocorrect/spellcheck pra evitar sugestão
            // de dicionário iOS atropelar termos tipo "lecge" (typo
            // intencional pra teste fuzzy).
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-cesta-green" />
            </div>
          ) : (data?.items ?? []).length === 0 ? (
            // Sprint 227 (#14 bundle 1): empty state explicit. Antes: lista
            // vazia silenciosa parecia bug (user nao sabia se backend 429,
            // se search nao casou, se timeout). Agora distingue "buscou e
            // nao achou" de "ainda carregando" + de erro via toast API.
            <p className="py-6 text-center text-sm text-muted">
              {search ? t("searchEmpty") : t("searchHint")}
            </p>
          ) : (
            <ul className="space-y-2">
              {(data?.items ?? []).map((product) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-card border border-border p-2"
                  data-testid="add-product-result"
                >
                  {/* Sprint 238 #3+#4: card principal clicável abre detalhe
                      do produto; thumbnail usa ProductImage com fallback
                      visual quando imageUrl é null/vazio ou falha runtime.
                      Botão Add fica como sibling (propagation não aplica —
                      clique só no main button abre detalhe). */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(`/produto/${product.id}`);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer text-left"
                    aria-label={t("openDetail", { name: product.name })}
                  >
                    <ProductImage
                      src={product.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      sizes="40px"
                      showLabel={false}
                      className="h-10 w-10 flex-shrink-0 rounded-btn object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-ink">
                        {product.name}
                      </p>
                      {product.cheapestPrice !== null && (
                        <p className="text-xs text-muted">
                          {t("fromPrice")} {formatPrice(product.cheapestPrice)}
                        </p>
                      )}
                    </div>
                  </button>
                  <Button
                    size="sm"
                    onClick={() => {
                      addItem.mutate(
                        { productId: product.id, quantity: 1 },
                        {
                          // Sprint 242 (#5): toast success i18n no caller
                          // porque sonner não roda dentro do Provider
                          // next-intl do hook. duration 3s + dismissible
                          // por padrão (comportamento sonner).
                          onSuccess: (list) => {
                            toast.success(
                              t("itemAddedToast", {
                                product: product.name,
                                list: list.name ?? listData?.name ?? "",
                              }),
                              { duration: 3000 },
                            );
                          },
                        },
                      );
                    }}
                    disabled={addItem.isPending}
                    aria-label={t("addToList")}
                    data-testid="add-product-add-btn"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
