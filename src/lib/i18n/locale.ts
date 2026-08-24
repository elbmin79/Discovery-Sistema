import type { Locale } from "../types";
import { dictionaries } from "./dictionaries";

export const LOCALE_KEY = "discovery-locale";

export function readLocale(): Locale {
  if (typeof window === "undefined") return "es";
  return window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "es";
}

export function writeLocale(locale: Locale) {
  window.localStorage.setItem(LOCALE_KEY, locale);
}

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
