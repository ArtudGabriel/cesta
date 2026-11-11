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
      <LoginForm />
    </div>
  );
}
