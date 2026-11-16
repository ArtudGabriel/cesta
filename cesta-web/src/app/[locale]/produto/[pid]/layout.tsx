import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return { title: `${t("produto")} · Cesta` };
}

export default function ProdutoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
