import type { Metadata } from "next";
import { House } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors.notFound");
  return { title: `${t("title")} · Cesta`, robots: { index: false } };
}

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-full bg-cesta-green/10 p-6">
        <House className="h-12 w-12 text-cesta-green" strokeWidth={1.5} />
      </div>
      <h1 className="font-display text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted">{t("body")}</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-pill bg-cesta-green px-6 text-sm font-semibold text-white hover:bg-cesta-green-dark"
      >
        {t("cta")}
      </Link>
    </main>
  );
}
