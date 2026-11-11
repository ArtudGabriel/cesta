import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

export function FieldError({ message, className, ...props }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn("text-xs text-coral mt-1", className)}
      {...props}
    >
      {message}
    </p>
  );
}
