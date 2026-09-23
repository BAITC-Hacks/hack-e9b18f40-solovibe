"use client";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
// Refresh the HttpOnly guest cookie on real visits; reading a page never creates a guest.
export function SessionBoundary() {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/city/owners/session", { cache: "no-store", signal: controller.signal }).catch(() => undefined);
    if (!("BroadcastChannel" in window)) return () => controller.abort();
    const channel = new BroadcastChannel("citybalance-session");
    channel.onmessage = () => router.refresh();
    return () => { controller.abort(); channel.close(); };
  }, [router]);
  return null;
}
