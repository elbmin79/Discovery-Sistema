"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el estado.");
        const data = (await response.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error de conexión.");
        }
      }
    }

    pull();
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      if (!event.data) return;
      try {
        setSnapshot(JSON.parse(event.data) as Snapshot);
        setError(null);
      } catch {
        // ignore malformed frames
      }
    };
    const poll = window.setInterval(pull, 2500);

    return () => {
      cancelled = true;
      events.close();
      window.clearInterval(poll);
    };
  }, []);

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
  return data as T;
}
