"use client";

import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  options: readonly SelectOption[];
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, hint, error, className, containerClassName, id, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", containerClassName)}>
      <label htmlFor={selectId} className="text-sm font-semibold leading-5 text-[var(--ink)]">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "min-h-12 w-full appearance-none rounded-[14px] border border-[#7C9186] bg-[var(--inset)] py-2.5 pr-11 pl-3.5 text-base text-[var(--ink)] shadow-[inset_0_1px_3px_#183c390c,0_1px_0_#fff] outline-none transition-[border-color,box-shadow,background-color] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
            error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
      </div>
      {hint ? <p id={hintId} className="text-sm leading-5 text-[var(--muted)]">{hint}</p> : null}
      {error ? <p id={errorId} className="text-sm font-medium leading-5 text-[var(--danger)]" role="alert">{error}</p> : null}
    </div>
  );
});
