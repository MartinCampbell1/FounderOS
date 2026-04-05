import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@founderos/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-[16px] tracking-wide",
  {
    variants: {
      tone: {
        neutral:
          "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.08] dark:text-[#9e9ea0]",
        success:
          "bg-emerald-500/[0.1] text-emerald-700 dark:bg-emerald-400/[0.12] dark:text-emerald-300",
        warning:
          "bg-amber-500/[0.1] text-amber-700 dark:bg-amber-400/[0.12] dark:text-amber-300",
        danger:
          "bg-red-500/[0.1] text-red-700 dark:bg-red-400/[0.12] dark:text-red-300",
        info:
          "bg-indigo-500/[0.1] text-indigo-700 dark:bg-indigo-400/[0.12] dark:text-indigo-300",
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
