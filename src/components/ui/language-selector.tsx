"use client";

import { useLocale } from "next-intl";
import { useTransition, type ChangeEvent, type SelectHTMLAttributes } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "./utils";

const languages = [
  { value: "ru", label: "Русский" },
  { value: "kk", label: "Қазақша" },
  { value: "en", label: "English" },
] as const;

export type AppLocale = (typeof languages)[number]["value"];

export interface LanguageSelectorProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange"> {
  label: string;
  beforeChange?: (nextLocale: AppLocale) => void | boolean | Promise<void | boolean>;
}

export function LanguageSelector({ label, beforeChange, className, disabled, ...props }: LanguageSelectorProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as AppLocale;
    if (nextLocale === locale) return;
    const shouldContinue = await beforeChange?.(nextLocale);
    if (shouldContinue === false) return;

    const query = window.location.search;
    const destination = `${pathname}${query}`;
    startTransition(() => router.replace(destination, { locale: nextLocale }));
  }

  return (
    <label className="relative inline-flex min-h-11 items-center">
      <span className="sr-only">{label}</span>
      <Languages className="pointer-events-none absolute left-3 size-4 text-[var(--muted)]" aria-hidden="true" />
      <select
        value={locale}
        onChange={handleChange}
        disabled={disabled || isPending}
        aria-label={label}
        aria-busy={isPending || undefined}
        className={cn(
          "min-h-11 appearance-none rounded-[14px] border border-[#7C9186] bg-[var(--surface)] py-2 pr-8 pl-9 text-sm font-semibold text-[var(--ink)] outline-none transition-[border-color,box-shadow,background-color] hover:bg-[var(--accent-soft)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {languages.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-[var(--muted)]" aria-hidden="true" />
    </label>
  );
}
