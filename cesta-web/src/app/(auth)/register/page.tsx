import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata = {
  title: "Crear cuenta — Cesta",
};

export default function RegisterPage() {
  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-bold text-ink">
        Crear cuenta
      </h2>
      <Suspense fallback={<FormSkeleton />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return <div className="h-96 animate-pulse rounded-card bg-neutral-100" />;
}
