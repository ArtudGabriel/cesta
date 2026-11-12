import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Iniciar sesión — Cesta",
};

export default function LoginPage() {
  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-bold text-ink">
        Iniciar sesión
      </h2>
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return <div className="h-72 animate-pulse rounded-card bg-neutral-100" />;
}
