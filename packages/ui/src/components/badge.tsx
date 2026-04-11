import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@founderos/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2 py-[1px] text-[11px] font-medium leading-4 tracking-normal shadow-none",
  {
    variants: {
      tone: {
        neutral:
          "bg-black/[0.04] text-foreground/70 dark:bg-white/[0.08] dark:text-white/70",
        success:
          "bg-emerald-500/[0.08] text-emerald-700 dark:bg-emerald-400/[0.12] dark:text-emerald-300",
        warning:
          "bg-amber-500/[0.08] text-amber-700 dark:bg-amber-400/[0.12] dark:text-amber-300",
        danger:
          "bg-red-500/[0.08] text-red-700 dark:bg-red-400/[0.12] dark:text-red-300",
        info:
          "bg-indigo-500/[0.08] text-indigo-700 dark:bg-indigo-400/[0.12] dark:text-indigo-300",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
