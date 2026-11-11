import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Elige una puntuación").max(5),
  comment: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;
