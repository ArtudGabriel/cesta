"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useAddFavorite,
  useIsFavorite,
  useRemoveFavorite,
} from "../hooks/use-favorites";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

interface FavoriteToggleProps {
  productId: string;
  returnUrl?: string;
  className?: string;
}

export function FavoriteToggle({
  productId,
  returnUrl,
  className,
}: FavoriteToggleProps) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const isFavorite = useIsFavorite(productId);
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const pending = add.isPending || remove.isPending;

  function toggle() {
    if (!user) {
      const next = returnUrl ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      router.push(`/login?returnUrl=${encodeURIComponent(next)}`);
      return;
    }
    if (isFavorite) remove.mutate(productId);
    else add.mutate(productId);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-60",
        "bg-white/90 backdrop-blur ring-1 ring-black/5 shadow-sm cursor-pointer",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-6 w-6 transition-colors",
          isFavorite ? "fill-[#ff6a4b] text-[#ff6a4b]" : "text-neutral-400",
        )}
      />
    </button>
  );
}
