"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { reviewSchema, type ReviewFormData } from "../schemas/review.schema";
import type { Review } from "../types/review.types";
import { StarRating } from "./star-rating";

interface ReviewFormProps {
  initial?: Pick<Review, "rating" | "comment">;
  isSubmitting?: boolean;
  onSubmit: (data: ReviewFormData) => void;
  onCancel?: () => void;
}

export function ReviewForm({
  initial,
  isSubmitting,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const {
    handleSubmit,
    setValue,
    watch,
    register,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: initial?.rating ?? 0,
      comment: initial?.comment ?? "",
    },
  });

  const rating = watch("rating");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Tu puntuación</Label>
        <StarRating
          value={rating}
          size="lg"
          onChange={(v) => setValue("rating", v, { shouldValidate: true })}
        />
        <FieldError message={errors.rating?.message} />
      </div>

      <div>
        <Label htmlFor="comment">Comentario (opcional)</Label>
        <textarea
          id="comment"
          rows={4}
          maxLength={1000}
          placeholder="¿Qué te pareció?"
          className="flex w-full rounded-btn border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-muted focus:border-cesta-green focus:outline-none focus:ring-2 focus:ring-cesta-green/20"
          {...register("comment")}
        />
        <FieldError message={errors.comment?.message} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Publicar
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
