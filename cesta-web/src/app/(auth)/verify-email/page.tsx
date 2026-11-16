import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerifyEmailClient } from "./verify-email-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: `${t("title")} · Cesta` };
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailClient />
    </Suspense>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="space-y-2">
      <div className="h-6 w-2/3 animate-pulse rounded bg-muted/30" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/20" />
    </div>
  );
}
