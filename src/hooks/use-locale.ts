"use client";

import { useSyncExternalStore } from "react";
import { getDictionary, readLocale, writeLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/types";

const LOCALE_EVENT = "discovery-locale";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCALE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCALE_EVENT, onChange);
  };
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "es" as Locale);

  function toggle() {
    writeLocale(locale === "es" ? "en" : "es");
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }

  return {
    locale,
    t: getDictionary(locale),
    toggle,
  };
}
