import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cesta-green/40",
  {
    variants: {
      variant: {
        primary:
          "bg-cesta-green text-white hover:bg-cesta-green-light active:bg-cesta-green-dark",
        secondary:
          "border-[1.5px] border-cesta-green text-cesta-green bg-transparent hover:bg-cesta-green/5",
        destructive:
          "bg-coral text-white hover:opacity-90",
        ghost:
          "bg-surface text-ink hover:bg-border/40",
        link: "text-cesta-green underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 rounded-btn text-base",
        sm: "h-10 px-4 rounded-btn text-sm",
        icon: "h-11 w-11 rounded-btn",
        pill: "h-8 px-3 rounded-pill text-xs",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
