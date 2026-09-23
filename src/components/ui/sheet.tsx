"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  closeLabel: string;
  side?: "left" | "right";
}

export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  function SheetContent({ className, children, closeLabel, side = "right", ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#183c3966] backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed top-3 bottom-3 z-50 flex w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-white/80 bg-[var(--surface)] p-6 text-[var(--ink)] shadow-[0_2px_5px_#153e3912,0_22px_60px_-16px_#153e3950,inset_0_1px_0_#fff] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none",
            side === "right" ? "right-3" : "left-3",
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-[14px] text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] motion-reduce:transition-none"
            aria-label={closeLabel}
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cn("pr-11 text-xl font-semibold leading-6 tracking-[-.02em]", className)} {...props} />;
});

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return <DialogPrimitive.Description ref={ref} className={cn("mt-2 text-base leading-6 text-[var(--muted)]", className)} {...props} />;
});

export function SheetBody({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mt-5 min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mt-5 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
