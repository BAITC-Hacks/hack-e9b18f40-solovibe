import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { Icon: LucideIcon; className: string }> = {
  info: { Icon: Info, className: "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--ink)]" },
  success: { Icon: CircleCheck, className: "border-[var(--success)]/30 bg-[#e2f1e7] text-[var(--success)]" },
  warning: { Icon: TriangleAlert, className: "border-[var(--warning)]/30 bg-[#f5edda] text-[var(--warning)]" },
  danger: { Icon: CircleAlert, className: "border-[var(--danger)]/30 bg-[#f8e6e3] text-[var(--danger)]" },
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  children: ReactNode;
}

export function Alert({ tone = "info", title, children, className, ...props }: AlertProps) {
  const { Icon, className: toneClassName } = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-[18px] border p-4", toneClassName, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-6 text-[var(--ink)]">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
