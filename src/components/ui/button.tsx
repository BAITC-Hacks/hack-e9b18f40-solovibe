"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border px-4 text-[15px] font-semibold leading-5 transition-[transform,box-shadow,background-color,border-color,color] duration-180 ease-[cubic-bezier(.23,1,.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] active:translate-y-px active:scale-[.98] disabled:pointer-events-none disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:transform-none",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--accent-dark)] bg-[linear-gradient(135deg,#0E8373_0%,var(--accent)_48%,#087061_100%)] text-white shadow-[0_2px_2px_#123e2e17,0_5px_10px_-4px_#123e2e29,inset_0_1px_0_#ffffff4d] hover:-translate-y-0.5 hover:shadow-[0_3px_4px_#123e2e18,0_8px_16px_-6px_#123e2e38,inset_0_1px_0_#ffffff4d] motion-reduce:hover:transform-none",
        secondary:
          "border-[#7C9186] bg-[var(--surface)] text-[var(--ink)] shadow-[0_2px_3px_#1b453b0b,inset_0_1px_0_#fff] hover:-translate-y-0.5 hover:bg-[var(--accent-soft)] motion-reduce:hover:transform-none",
        quiet:
          "border-transparent bg-transparent text-[var(--accent-dark)] hover:bg-[var(--accent-soft)]",
        danger:
          "border-[var(--danger)] bg-[var(--danger)] text-white shadow-[0_2px_2px_#42151120,inset_0_1px_0_#ffffff40] hover:-translate-y-0.5 hover:brightness-95 motion-reduce:hover:transform-none",
      },
      size: {
        default: "min-h-12 px-5",
        compact: "min-h-11 px-3.5 text-sm",
        icon: "size-11 min-h-11 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, loadingLabel, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
      <span className="inline-flex items-center justify-center gap-2">{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});

export { buttonVariants };
