"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "./utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex min-h-12 max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--inset)] p-1", className)}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-[var(--muted)] outline-none transition-[background-color,color,box-shadow] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--ink)] data-[state=active]:shadow-[0_2px_6px_#183c3914,inset_0_1px_0_#fff] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("mt-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]", className)} {...props} />;
});
