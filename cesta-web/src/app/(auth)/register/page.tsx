import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FormSkeleton } from "@/features/auth/components/form-skeleton";
import { RegisterForm } from "@/features/auth/components/register-form";
import { RegisterHeading } from "./register-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: `${t("title")} · Cesta` };
}

export default function RegisterPage() {
  return (
    <div>
      <RegisterHeading />
      <Suspense fallback={<FormSkeleton rows={3} />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
