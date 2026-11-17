"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTwoFactorChallenge } from "@/features/auth/hooks/use-auth";

export default function TwoFactorChallengePage() {
  const t = useTranslations("twoFactor.challenge");
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "backup">("code");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const challenge = useTwoFactorChallenge();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const partial = sessionStorage.getItem("cesta:2fa:partialToken");
    if (!partial) router.replace("/login");
  }, [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "code") {
      if (!/^[0-9]{6}$/.test(code)) return;
      challenge.mutate({ code });
    } else {
      if (!/^[A-Z0-9]{10}$/.test(backupCode)) return;
      challenge.mutate({ backupCode });
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <h1 className="font-display text-2xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{t(mode === "code" ? "hint" : "backupHint")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "code" ? (
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink">
              {t("codeLabel")}
            </label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              data-sentry-mask
            />
          </div>
        ) : (
          <div>
            <label htmlFor="backupCode" className="mb-1 block text-sm font-medium text-ink">
              {t("backupLabel")}
            </label>
            <Input
              id="backupCode"
              maxLength={10}
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder="ABCDE12345"
              autoFocus
              data-sentry-mask
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={challenge.isPending}
          className="w-full"
        >
          {challenge.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("submit")
          )}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "code" ? "backup" : "code")}
          className="w-full text-sm text-cesta-green underline"
        >
          {t(mode === "code" ? "useBackup" : "useCode")}
        </button>
      </form>
    </main>
  );
}
