"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DemoSession } from "@/lib/types";

const KEY = "discovery-session";
const EVENT = "discovery-session";

let cachedRaw: string | null = null;
let cachedSession: DemoSession | null = null;

function readSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  if (!raw) {
    cachedSession = null;
    return null;
  }
  try {
    cachedSession = JSON.parse(raw) as DemoSession;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

function getServerSession(): DemoSession | null {
  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useSession(role?: DemoSession["role"]) {
  const session = useSyncExternalStore(subscribe, readSession, getServerSession);
  const matched = session && (!role || session.role === role) ? session : null;

  const setSession = useCallback((next: DemoSession) => {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
    cachedRaw = null;
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clearSession = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" });
    window.sessionStorage.removeItem(KEY);
    cachedRaw = null;
    cachedSession = null;
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { session: matched, setSession, clearSession };
}
