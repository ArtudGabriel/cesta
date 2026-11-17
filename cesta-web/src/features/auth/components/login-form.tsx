"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useLogin } from "../hooks/use-auth";
import { loginSchema, type LoginFormData } from "../schemas/auth.schema";
import type {
  ReactivatePayload,
  SoftDeletedMeta,
} from "../types/auth.types";
import { AccountSoftDeletedBanner } from "./account-soft-deleted-banner";

type Method = "email" | "phone";

interface SoftDeletedState {
  meta: SoftDeletedMeta;
  payload: ReactivatePayload;
}

function parseSoftDeletedMeta(err: unknown): SoftDeletedMeta | null {
  if (!(err instanceof ApiError)) return null;
  if (err.errorCode !== "AUTH.ACCOUNT_SOFT_DELETED") return null;
  const meta = err.meta;
  if (!meta || typeof meta !== "object") return null;
  const deletedAt = (meta as { deletedAt?: unknown }).deletedAt;
  const graceEndsAt = (meta as { graceEndsAt?: unknown }).graceEndsAt;
  if (typeof deletedAt !== "string" || typeof graceEndsAt !== "string") {
    return null;
  }
  return { deletedAt, graceEndsAt };
}

export function LoginForm() {
  const [method, setMethod] = useState<Method>("email");
  const [softDeleted, setSoftDeleted] = useState<SoftDeletedState | null>(null);
  const login = useLogin();
  const t = useTranslations("auth");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", phone: "", password: "" },
  });

  function onSubmit(data: LoginFormData) {
    const payload: ReactivatePayload =
      method === "email"
        ? { email: data.email, password: data.password }
        : { phone: data.phone, password: data.password };
    setSoftDeleted(null);
    login.mutate(payload, {
      onError: (err) => {
        const meta = parseSoftDeletedMeta(err);
        if (meta) setSoftDeleted({ meta, payload });
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {softDeleted && (
        <AccountSoftDeletedBanner
          meta={softDeleted.meta}
          payload={softDeleted.payload}
          onDismiss={() => setSoftDeleted(null)}
        />
      )}
      <div className="flex gap-2 rounded-pill bg-surface p-1">
        {(["email", "phone"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`flex-1 rounded-pill py-2 text-sm font-medium transition-colors cursor-pointer ${
              method === m
                ? "bg-cesta-green text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            {m === "email" ? t("methodEmail") : t("methodPhone")}
          </button>
        ))}
      </div>

      {method === "email" ? (
        <div>
          <Label htmlFor="email">{t("login.emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("login.emailPlaceholder")}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
      ) : (
        <div>
          <Label htmlFor="phone">{t("login.phoneLabel")}</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t("login.phonePlaceholder")}
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </div>
      )}

      <div>
        <Label htmlFor="password">{t("login.passwordLabel")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="text-cesta-green font-medium">
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  );
}
