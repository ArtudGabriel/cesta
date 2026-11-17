"use client";

import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/features/auth/services/auth.service";
import { translateError } from "@/lib/translate-error";
import { useProfile } from "../hooks/use-profile";
import { cn } from "@/lib/utils";

type FlowStage =
  | "idle"
  | "showQr"
  | "showBackups"
  | "confirmDisable";

export function TwoFactorSection() {
  const t = useTranslations("profile.security");
  const tErr = useTranslations("errors");
  const { data: profile, refetch } = useProfile();
  const [stage, setStage] = useState<FlowStage>("idle");
  const [enrollData, setEnrollData] = useState<{
    secret: string;
    qrCodeDataUri: string;
    otpauthUrl: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // S99 ajuste: enquanto backend não deployar (Render stuck pending env vars),
  // o campo vem undefined → esconde seção inteira pra não expor CTA que
  // chamaria /auth/2fa/enroll e retornaria 404.
  const enabled = profile?.twoFactorEnabled;
  if (enabled === undefined) return null;

  const enroll = useMutation({
    mutationFn: () => authService.twoFactorEnroll(),
    onSuccess: (data) => {
      setEnrollData(data);
      setStage("showQr");
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });

  const verify = useMutation({
    mutationFn: (code: string) => authService.twoFactorVerify(code),
    onSuccess: async (data) => {
      setBackupCodes(data.backupCodes);
      setStage("showBackups");
      setVerifyCode("");
      await refetch();
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });

  const disable = useMutation({
    mutationFn: () => authService.twoFactorDisable(disablePassword, disableCode),
    onSuccess: async () => {
      toast.success(t("disabledToast"));
      setStage("idle");
      setDisablePassword("");
      setDisableCode("");
      await refetch();
    },
    onError: (err: Error) => toast.error(translateError(err, tErr)),
  });

  return (
    <section className="px-4 pt-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("title")}
      </h2>
      <div className="rounded-card bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {enabled ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-cesta-green" aria-hidden />
          ) : (
            <ShieldOff className="mt-0.5 h-5 w-5 text-muted" aria-hidden />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">
              {t(enabled ? "statusEnabled" : "statusDisabled")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t(enabled ? "statusEnabledHint" : "statusDisabledHint")}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {enabled ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setStage("confirmDisable")}
              disabled={disable.isPending}
            >
              {t("disableCta")}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => enroll.mutate()}
              disabled={enroll.isPending}
            >
              {enroll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("enableCta")
              )}
            </Button>
          )}
        </div>
      </div>

      {stage === "showQr" && enrollData && (
        <Modal onClose={() => setStage("idle")} title={t("scanTitle")}>
          <p className="text-sm text-muted">{t("scanHint")}</p>
          <div className="mt-4 flex justify-center">
            {/* data URI: Image width/height mandatórios */}
            <Image
              src={enrollData.qrCodeDataUri}
              alt="QR"
              width={192}
              height={192}
              unoptimized
            />
          </div>
          <p className="mt-2 break-all text-center text-[11px] text-muted" data-sentry-mask>
            {enrollData.secret}
          </p>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-ink">
              {t("codeLabel")}
            </label>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              data-sentry-mask
            />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => verify.mutate(verifyCode)}
            disabled={verify.isPending || !/^\d{6}$/.test(verifyCode)}
          >
            {verify.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("verifyCta")
            )}
          </Button>
        </Modal>
      )}

      {stage === "showBackups" && backupCodes.length > 0 && (
        <Modal onClose={() => setStage("idle")} title={t("backupsTitle")}>
          <p className="text-sm text-muted">{t("backupsHint")}</p>
          <ul
            className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-neutral-50 p-3 font-mono text-sm"
            data-sentry-mask
          >
            {backupCodes.map((c) => (
              <li key={c} className="text-center">
                {c}
              </li>
            ))}
          </ul>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              navigator.clipboard?.writeText(backupCodes.join("\n"));
              toast.success(t("copiedToast"));
            }}
          >
            {t("copyCta")}
          </Button>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => setStage("idle")}
          >
            {t("doneCta")}
          </Button>
        </Modal>
      )}

      {stage === "confirmDisable" && (
        <Modal onClose={() => setStage("idle")} title={t("disableTitle")}>
          <p className="text-sm text-muted">{t("disableHint")}</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                {t("passwordLabel")}
              </label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                data-sentry-mask
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                {t("codeLabel")}
              </label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                data-sentry-mask
              />
            </div>
          </div>
          <Button
            variant="secondary"
            className={cn("mt-4 w-full border-rose-600 text-rose-600")}
            onClick={() => disable.mutate()}
            disabled={
              disable.isPending ||
              !disablePassword ||
              !/^\d{6}$/.test(disableCode)
            }
          >
            {disable.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("disableConfirmCta")
            )}
          </Button>
        </Modal>
      )}
    </section>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-card bg-white p-5 shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
