"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, cityApi } from "@/lib/city-api";
export function useDeliveryRequests() {
    const pending = useRef(new Set<AbortController>()), alive = useRef(true);
    const [sessionChanged, setSessionChanged] = useState(false);
    useEffect(() => { alive.current = true; const requests = pending.current; const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("citybalance-session") : null; if (channel)
        channel.onmessage = e => { if (e.data?.changed) {
            alive.current = false;
            requests.forEach(a => a.abort());
            setSessionChanged(true);
        } }; return () => { alive.current = false; requests.forEach(a => a.abort()); channel?.close(); }; }, []);
    const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown) => { if(!alive.current)throw new DOMException("Aborted","AbortError"); const a = new AbortController(); pending.current.add(a); try {
        const result = await cityApi<T>(path, { method, body, signal: a.signal });
        if (!alive.current || a.signal.aborted)
            throw new DOMException("Aborted", "AbortError");
        return result;
    }
    finally {
        pending.current.delete(a);
    } }, []);
    const download = useCallback(async (path: string, fallback: string) => { if(!alive.current)throw new DOMException("Aborted","AbortError"); const a = new AbortController(); pending.current.add(a); try {
        const response = await fetch(`/api/city${path}`, { cache: "no-store", credentials: "same-origin", signal: a.signal });
        if (!response.ok)
            throw new ApiFailure(await response.json());
        const bytes = await response.blob();
        if (!alive.current || a.signal.aborted)
            throw new DOMException("Aborted", "AbortError");
        const href = URL.createObjectURL(bytes), link = document.createElement("a");
        link.href = href;
        link.download = fallback;
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
    finally {
        pending.current.delete(a);
    } }, []);
    return { request, download, sessionChanged };
}
export function aborted(error: unknown) { return error instanceof DOMException && error.name === "AbortError"; }
