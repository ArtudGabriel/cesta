import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return { title: `${t("minhaLista")} · Cesta` };
}

export default function MinhaListaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
