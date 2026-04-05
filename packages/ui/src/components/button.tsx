"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@founderos/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-button)] hover:brightness-[1.04]",
        outline:
          "border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-foreground hover:bg-[color:var(--shell-control-hover)]",
        secondary:
          "border-[color:var(--shell-control-border)] bg-secondary text-secondary-foreground hover:bg-[color:var(--shell-control-hover)]",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-[color:var(--shell-panel-muted)] hover:text-foreground",
      },
      size: {
        default: "h-8 px-[14px] text-[13px] leading-4",
        sm: "h-6 px-2.5 text-[12px] leading-[15px]",
        lg: "h-12 px-[14px] text-[15px] font-normal leading-[22px]",
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
