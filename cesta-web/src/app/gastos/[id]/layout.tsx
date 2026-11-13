import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.title");
  return { title: `${t("gastosDetail")} · Cesta` };
}

export default function GastosDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
