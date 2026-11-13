import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return { title: `${t("comparar")} · Cesta` };
}

export default function CompararLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
