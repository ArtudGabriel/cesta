import { z } from "zod";

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

const identifierSchema = z
  .object({
    email: z
      .string()
      .email("Email inválido")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .regex(PHONE_REGEX, "Telefone inválido (ex: +34600111222)")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Informe email ou telefone",
    path: ["email"],
  });

export const loginSchema = identifierSchema.and(
  z.object({
    password: z.string().min(1, "Senha obrigatória"),
  }),
);

export const registerSchema = identifierSchema.and(
  z.object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(128, "Máximo 128 caracteres"),
    name: z.string().max(120).optional(),
    locale: z.enum(["es", "pt-BR"]).optional(),
  }),
);

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
