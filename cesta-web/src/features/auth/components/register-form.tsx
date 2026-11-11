"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "../hooks/use-auth";
import {
  registerSchema,
  type RegisterFormData,
} from "../schemas/auth.schema";

type Method = "email" | "phone";

export function RegisterForm() {
  const [method, setMethod] = useState<Method>("email");
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
      name: "",
      locale: "es",
    },
  });

  function onSubmit(data: RegisterFormData) {
    const payload = {
      ...(method === "email"
        ? { email: data.email }
        : { phone: data.phone }),
      password: data.password,
      name: data.name || undefined,
      locale: data.locale ?? "es",
    };
    registerMutation.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            {m === "email" ? "Email" : "Teléfono"}
          </button>
        ))}
      </div>

      {method === "email" ? (
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
      ) : (
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+34600111222"
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </div>
      )}

      <div>
        <Label htmlFor="name">Nombre (opcional)</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={registerMutation.isPending}
      >
        {registerMutation.isPending && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-cesta-green font-medium">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
