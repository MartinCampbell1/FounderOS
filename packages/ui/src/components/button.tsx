"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@founderos/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[8px] border text-[13px] font-medium shadow-none transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:brightness-[1.03]",
        outline:
          "border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-foreground hover:bg-[color:var(--shell-control-hover)] hover:text-foreground",
        secondary:
          "border-[color:var(--shell-control-border)] bg-secondary text-secondary-foreground hover:bg-[color:var(--shell-control-hover)]",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-[color:var(--shell-panel-muted)] hover:text-foreground",
      },
      size: {
        default: "h-8 px-3 text-[13px] leading-none",
        sm: "h-7 px-2.5 text-[12px] leading-none",
        lg: "h-10 px-[14px] text-[14px] leading-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
