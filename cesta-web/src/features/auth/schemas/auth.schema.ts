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

export const buildRegisterSchema = (messages: {
  emailMismatch: string;
  passwordMismatch: string;
}) =>
  z
    .object({
      email: z
        .string()
        .email("Email inválido")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      confirmEmail: z
        .string()
        .optional()
        .or(z.literal("").transform(() => undefined)),
      phone: z
        .string()
        .regex(PHONE_REGEX, "Telefone inválido (ex: +34600111222)")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      password: z
        .string()
        .min(8, "Mínimo 8 caracteres")
        .max(128, "Máximo 128 caracteres"),
      confirmPassword: z.string().max(128),
      name: z.string().max(120).optional(),
      locale: z.enum(["es", "pt-BR"]).optional(),
    })
    .refine((data) => Boolean(data.email || data.phone), {
      message: "Informe email ou telefone",
      path: ["email"],
    })
    .refine((data) => !data.email || data.email === data.confirmEmail, {
      message: messages.emailMismatch,
      path: ["confirmEmail"],
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordMismatch,
      path: ["confirmPassword"],
    });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<ReturnType<typeof buildRegisterSchema>>;
