import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHeading } from "./login-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: `${t("title")} · Cesta` };
}

export default function LoginPage() {
  return (
    <div>
      <LoginHeading />
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return <div className="h-72 animate-pulse rounded-card bg-neutral-100" />;
}
