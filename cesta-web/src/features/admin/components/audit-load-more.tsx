"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Sprint 104: load-more via Link SSR (nova página = refetch com offset
 * maior). Simples, não precisa client state — página server component
 * reemite tudo. Scroll fica onde o user estava.
 */
export function AuditLoadMore({
  nextOffset,
}: {
  nextOffset: number;
}) {
  const t = useTranslations("admin.audit");
  const params = useSearchParams();
  const qs = new URLSearchParams(params.toString());
  qs.set("offset", String(nextOffset));

  return (
    <div className="flex justify-center pt-4">
      <Link href={`?${qs.toString()}`} scroll={false}>
        <Button variant="secondary" type="button">
          {t("loadMore")}
        </Button>
      </Link>
    </div>
  );
}
