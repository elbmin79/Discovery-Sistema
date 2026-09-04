"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";

type Listener = (snapshot: Snapshot) => void;

const listeners = new Set<Listener>();
let latest: Snapshot | null = null;

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Snapshot>;
  return Array.isArray(data.trips) && Array.isArray(data.requests) && typeof data.updatedAt === "string";
}

function isNewer(next: Snapshot, current: Snapshot | null) {
  if (!current) return true;
  return next.updatedAt >= current.updatedAt;
}

export function rememberSnapshot(next: Snapshot) {
  if (!isNewer(next, latest)) return;
  latest = next;
  for (const listener of listeners) listener(next);
}

export function useSnapshot(enabled = true) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(latest);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const listener: Listener = (value) => setSnapshot(value);
    listeners.add(listener);

    let cancelled = false;

    async function pull() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el estado.");
        const data = (await response.json()) as Snapshot;
        if (!cancelled) {
          rememberSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error de conexión.");
        }
      }
    }

    pull();
    const poll = window.setInterval(pull, 2000);

    return () => {
      cancelled = true;
      listeners.delete(listener);
      window.clearInterval(poll);
    };
  }, [enabled]);

  return { snapshot, error };
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "No se pudo completar la acción.");
  }
  if (isSnapshot(data)) rememberSnapshot(data);
  return data as T;
}
