import { SCHOOL_TIMEZONE } from "./school";
import type {
  CalendarEventColor,
  Guardian,
  Locale,
  SchoolAnnouncement,
  SchoolCalendarEvent,
  Snapshot,
} from "./types";

export const ANNOUNCEMENT_RECENT_LIMIT = 8;
export const ANNOUNCEMENT_ARCHIVE_PAGE_SIZE = 8;

export const CALENDAR_EVENT_COLORS: {
  id: CalendarEventColor;
  label: string;
  bg: string;
  fg: string;
  swatch: string;
}[] = [
  { id: "forest", label: "Bosque", bg: "#d7e6df", fg: "#12382d", swatch: "#1b4d3e" },
  { id: "gold", label: "Oro", bg: "#f3e6c8", fg: "#5c4518", swatch: "#c4a15a" },
  { id: "sky", label: "Cielo", bg: "#d7e6f2", fg: "#1a3a52", swatch: "#5a8fb5" },
  { id: "coral", label: "Coral", bg: "#f4d8d2", fg: "#6b2f28", swatch: "#c47266" },
  { id: "sand", label: "Arena", bg: "#ebe3d3", fg: "#3f3a30", swatch: "#a89578" },
  { id: "mint", label: "Menta", bg: "#d5ebe4", fg: "#1a4a3e", swatch: "#4f9a86" },
];

export function calendarEventStyle(color?: CalendarEventColor | string) {
  const match = CALENDAR_EVENT_COLORS.find((item) => item.id === color) ?? CALENDAR_EVENT_COLORS[0];
  return match;
}

export function isCalendarEventColor(value: unknown): value is CalendarEventColor {
  return typeof value === "string" && CALENDAR_EVENT_COLORS.some((item) => item.id === value);
}

export function unreadAnnouncements(snapshot: Snapshot, guardian: Guardian) {
  const reads = new Set(guardian.readAnnouncementIds ?? []);
  return [...(snapshot.announcements ?? [])]
    .filter((item) => !reads.has(item.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function sortedAnnouncements(snapshot: Snapshot) {
  return [...(snapshot.announcements ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function splitAnnouncements(snapshot: Snapshot) {
  const list = sortedAnnouncements(snapshot);
  return {
    recent: list.slice(0, ANNOUNCEMENT_RECENT_LIMIT),
    previous: list.slice(ANNOUNCEMENT_RECENT_LIMIT),
  };
}

export function announcementDayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function announcementDayLabel(iso: string, locale: Locale) {
  const label = new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function groupAnnouncementsByDay(items: SchoolAnnouncement[]) {
  const groups: { key: string; labelIso: string; items: SchoolAnnouncement[] }[] = [];
  for (const item of items) {
    const key = announcementDayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, labelIso: item.createdAt, items: [item] });
  }
  return groups;
}

export function eventsOnDate(snapshot: Snapshot, date: string) {
  return [...(snapshot.calendarEvents ?? [])]
    .filter((item) => item.date === date)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}

export function eventDatesInMonth(snapshot: Snapshot, year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const dates = new Set<string>();
  for (const event of snapshot.calendarEvents ?? []) {
    if (event.date.startsWith(prefix)) dates.add(event.date);
  }
  return dates;
}

export function monthLabel(year: number, month: number, locale: "es" | "en") {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const label = date.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildMonthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type { SchoolAnnouncement, SchoolCalendarEvent };
