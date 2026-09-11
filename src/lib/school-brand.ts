import type { SchoolBrandId } from "./types";

export const BRAND_STORAGE_KEY = "salida-brand";

export const SCHOOL_BRANDS = {
  discovery: {
    id: "discovery" as const,
    name: "Discovery American Preschool & Academy",
    shortName: "Discovery",
    tagline: "American Preschool & Academy",
    taglineRow: "Salida escolar",
    appName: "Salida Discovery",
    logoSrc: "/brand/logo.png",
    faviconSrc: "/brand/favicon-d.png",
    staffFallback: "Personal de Discovery",
    themeColor: "#1B4D3E",
    accent: "#1B4D3E",
  },
  altius: {
    id: "altius" as const,
    name: "Colegio Altius",
    shortName: "Altius",
    tagline: "Secundaria",
    taglineRow: "Salida escolar",
    appName: "Salida Altius",
    logoSrc: "/brand/altius-mark.png",
    faviconSrc: "/brand/favicon-a.png",
    staffFallback: "Personal de Altius",
    themeColor: "#1C3D73",
    accent: "#1C3D73",
  },
} as const;

const GREEN_TO_BLUE: Record<string, string> = {
  "#1B4D3E": "#1C3D73",
  "#12382D": "#132850",
  "#2D6B56": "#2D5AA0",
  "#3E6B54": "#3A5C96",
  "#2F5D4A": "#2C528A",
  "#4A6B3A": "#3D5A8C",
  "#2A5344": "#244A7A",
  "#3A5C4C": "#335680",
  "#5C7A6A": "#5A7AA8",
};

export function isSchoolBrandId(value: unknown): value is SchoolBrandId {
  return value === "discovery" || value === "altius";
}

export function normalizeSchoolBrand(value: unknown): SchoolBrandId {
  return value === "altius" ? "altius" : "discovery";
}

export function schoolBrandProfile(value: unknown) {
  return SCHOOL_BRANDS[normalizeSchoolBrand(value)];
}

export function schoolStaffFallback(value: unknown) {
  return schoolBrandProfile(value).staffFallback;
}

export function brandedAccent(color: string | undefined, brand: SchoolBrandId) {
  if (!color) return undefined;
  if (brand !== "altius") return color;
  return GREEN_TO_BLUE[color.toUpperCase()] ?? color;
}

export function forestHex() {
  if (typeof document === "undefined") return SCHOOL_BRANDS.discovery.accent;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--forest").trim();
  return value || SCHOOL_BRANDS.discovery.accent;
}

export function applySchoolBrand(brand: SchoolBrandId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (brand === "altius") root.dataset.brand = "altius";
  else delete root.dataset.brand;
  const profile = SCHOOL_BRANDS[brand];
  document.title = profile.appName;
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute("content", profile.themeColor);
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  )) {
    link.href = profile.faviconSrc;
  }
}

export function readStoredBrand(): SchoolBrandId {
  try {
    return normalizeSchoolBrand(globalThis.localStorage?.getItem(BRAND_STORAGE_KEY));
  } catch {
    return "discovery";
  }
}

export function persistBrand(brand: SchoolBrandId) {
  try {
    globalThis.localStorage?.setItem(BRAND_STORAGE_KEY, brand);
  } catch {
    return;
  }
}

export function withSchoolName(template: string, school: string) {
  return template.replaceAll("{school}", school);
}
