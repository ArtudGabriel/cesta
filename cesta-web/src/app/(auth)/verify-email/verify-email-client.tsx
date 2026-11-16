"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "@/features/auth/hooks/use-auth";
import { translateError } from "@/lib/translate-error";

export function VerifyEmailClient() {
  const t = useTranslations("auth.verifyEmail");
  const tErr = useTranslations("errors");
  const params = useSearchParams();
  const token = params.get("token");
  const verify = useVerifyEmail();
  const triggered = useRef(false);

  useEffect(() => {
    if (!token || triggered.current) return;
    triggered.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (!token) {
    return (
      <State title={t("missingTokenTitle")} body={t("missingTokenBody")}>
        <Link href="/login">
          <Button variant="secondary" className="w-full">
            {t("goLogin")}
          </Button>
        </Link>
      </State>
    );
  }

  if (verify.isPending || verify.isIdle) {
    return (
      <State title={t("title")} body={t("pending")}>
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-cesta-green border-t-transparent" />
      </State>
    );
  }

  if (verify.isSuccess) {
    return (
      <State title={t("successTitle")} body={t("successBody")}>
        <Link href="/">
          <Button className="w-full">{t("goHome")}</Button>
        </Link>
      </State>
    );
  }

  return (
    <State
      title={t("failedTitle")}
      body={verify.error ? translateError(verify.error, tErr) : ""}
    >
      <Button
        className="w-full"
        onClick={() => {
          triggered.current = true;
          verify.mutate(token);
        }}
      >
        {t("tryAgain")}
      </Button>
    </State>
  );
}

function State({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {body ? <p className="text-sm text-muted">{body}</p> : null}
      <div className="pt-2">{children}</div>
    </div>
  );
}
