"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  standalone?: boolean;
};

function installed() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as BadgeNavigator).standalone);
}

function subscribe(listener: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function useAppBadge(count: number, active: boolean) {
  const isInstalled = useSyncExternalStore(subscribe, installed, () => false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    const badge = navigator as BadgeNavigator;
    const sync = () => {
      if (active && count > 0) void badge.setAppBadge?.(count).catch(() => undefined);
      else void badge.clearAppBadge?.().catch(() => undefined);
    };
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [count, active, permission]);

  async function enable() {
    if (!("Notification" in window)) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission("denied");
    }
  }

  const supported = isInstalled && typeof navigator !== "undefined" && "setAppBadge" in navigator && "Notification" in window;
  const currentPermission = supported ? permission ?? Notification.permission : null;
  return { enable, canEnable: supported && currentPermission === "default", denied: supported && currentPermission === "denied" };
}
