"use client";

import { useCallback, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function usePushNotifications() {
  const [supported] = useState(() => pushSupported());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    pushSupported() ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setPermission("unsupported");
      setSubscribed(false);
      setChecked(true);
      return;
    }
    setPermission(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    } catch {
      setSubscribed(false);
    } finally {
      setChecked(true);
    }
  }, []);

  const enable = useCallback(async () => {
    if (!pushSupported()) {
      setError("Este dispositivo no admite notificaciones push.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setError("Necesitas permitir notificaciones para recibir avisos.");
        return;
      }
      const vapid = await fetch("/api/push/vapid", { credentials: "include" }).then(async (response) => {
        const data = (await response.json()) as { publicKey?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo obtener la clave push.");
        return data.publicKey!;
      });
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        }));
      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription: {
            endpoint: json.endpoint,
            keys: json.keys,
          },
        }),
      }).then(async (response) => {
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo guardar la suscripción.");
      });
      setSubscribed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [refresh]);

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    checked,
    enable,
    refresh,
  };
}
