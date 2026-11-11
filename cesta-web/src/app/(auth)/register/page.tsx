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
      <RegisterForm />
    </div>
  );
}
