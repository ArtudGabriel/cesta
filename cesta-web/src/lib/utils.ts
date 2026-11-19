import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Sprint 118 — style:'decimal' + "€" sufixo garante layout consistente em
// qualquer locale. Com style:'currency' + EUR, pt-BR prepend "€ 4,20" e
// es-ES append "4,20 €"; no PDP mobile isso empilhava formatos diferentes e
// o usuário via o símbolo "duplicado" entre preço principal e unit price.
export function formatPrice(value: number, locale: string = "es-ES"): string {
  const n = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${n} €`;
}
