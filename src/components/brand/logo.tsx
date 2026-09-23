import type { HTMLAttributes } from "react";
import { cn } from "../ui/utils";

export interface LogoProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  variant?: "mark" | "wordmark";
  label?: string;
}

function CityBalanceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 208 208" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M24 139V93c0-8 6-14 14-14s14 6 14 14v46M58 139V62c0-8 6-14 14-14s14 6 14 14v77M92 139V79c0-8 6-14 14-14s14 6 14 14v60M126 132V38c0-8 6-14 14-14s14 6 14 14v94M160 116V66c0-8 6-14 14-14s14 6 14 14v50"
        fill="var(--accent)"
      />
      <path
        d="M24 164h70c42 0 71-15 94-44"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path d="M34 84a8 8 0 0 1 8-5h6v12H30z" fill="#ffffff4f" />
      <path d="M68 53a8 8 0 0 1 8-5h6v12H64z" fill="#ffffff4f" />
      <path d="M102 70a8 8 0 0 1 8-5h6v12H98z" fill="#ffffff4f" />
      <path d="M136 29a8 8 0 0 1 8-5h6v12h-18z" fill="#ffffff4f" />
      <path d="M170 57a8 8 0 0 1 8-5h6v12h-18z" fill="#ffffff4f" />
    </svg>
  );
}

export function Logo({ variant = "wordmark", label = "CityBalance", className, ...props }: LogoProps) {
  return (
    <div
      className={cn("inline-flex items-center text-[var(--ink)]", variant === "wordmark" ? "gap-2.5" : "", className)}
      aria-label={label}
      role="img"
      {...props}
    >
      <CityBalanceMark className={variant === "mark" ? "size-full" : "size-10"} />
      {variant === "wordmark" ? (
        <span className="text-xl font-semibold tracking-[-.04em]">CityBalance</span>
      ) : null}
    </div>
  );
}

export { CityBalanceMark };
