import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("expenses.detail");
  const tNav = await getTranslations("nav");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm text-coral">{t("notFound")}</p>
      <Button asChild variant="secondary" size="sm">
        <Link href="/gastos">{tNav("back")}</Link>
      </Button>
    </main>
  );
}
