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
  size?: "sm" | "md";
}

export function FavoriteToggle({
  productId,
  returnUrl,
  className,
  size = "md",
}: FavoriteToggleProps) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const isFavorite = useIsFavorite(productId);
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const pending = add.isPending || remove.isPending;

  function toggle(e: React.MouseEvent) {
    // Evita navegar quando usado dentro de um card/link clicável
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      const next = returnUrl ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      router.push(`/login?returnUrl=${encodeURIComponent(next)}`);
      return;
    }
    if (isFavorite) remove.mutate(productId);
    else add.mutate(productId);
  }

  const visualSize =
    size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
      // Hit-area expandida via ::before (pseudo-element invisível) garante
      // touch target WCAG 44x44 mesmo quando visual é 36x36 (size=sm).
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-60",
        "bg-white/90 backdrop-blur ring-1 ring-black/5 shadow-sm cursor-pointer",
        "before:absolute before:inset-[-6px] before:content-['']",
        visualSize,
        className,
      )}
    >
      <Heart
        className={cn(
          "transition-colors",
          iconSize,
          isFavorite ? "fill-[#ff6a4b] text-[#ff6a4b]" : "text-neutral-400",
        )}
      />
    </button>
  );
}
