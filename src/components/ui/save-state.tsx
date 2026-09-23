import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "./utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveStateLabels {
  idle: string;
  saving: string;
  saved: string;
  error: string;
}

export interface SaveStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  status: SaveStatus;
  labels: SaveStateLabels;
}

export function SaveState({ status, labels, className, ...props }: SaveStateProps) {
  const label = labels[status];
  const Icon = status === "error" ? AlertCircle : status === "saved" ? Check : LoaderCircle;
  const visibleIcon = status !== "idle";

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[14px] px-3 text-sm font-medium text-[var(--muted)]",
        status === "saved" && "text-[var(--success)]",
        status === "error" && "text-[var(--danger)]",
        className,
      )}
      {...props}
    >
      {visibleIcon ? (
        <Icon className={cn("size-4", status === "saving" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </div>
  );
}
