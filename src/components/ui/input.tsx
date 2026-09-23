"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, containerClassName, id, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", containerClassName)}>
      <label htmlFor={inputId} className="text-sm font-semibold leading-5 text-[var(--ink)]">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 w-full rounded-[14px] border border-[#7C9186] bg-[var(--inset)] px-3.5 py-2.5 text-base text-[var(--ink)] shadow-[inset_0_1px_3px_#183c390c,0_1px_0_#fff] outline-none placeholder:text-[var(--muted)]/75 transition-[border-color,box-shadow,background-color] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
          error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm leading-5 text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium leading-5 text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
