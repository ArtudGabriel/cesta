import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return { title: `${t("minhaListaDetail")} · Cesta` };
}

export default function MinhaListaDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
