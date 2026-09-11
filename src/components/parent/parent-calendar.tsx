"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid, calendarEventStyle, eventDatesInMonth, eventsOnDate, monthLabel } from "@/lib/school-comms";
import { todayJornada } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale, Snapshot } from "@/lib/types";

const WEEKDAYS_ES = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_EN = ["M", "T", "W", "T", "F", "S", "S"];

export function ParentCalendar({
  snapshot,
  locale,
  t,
  onBack,
}: {
  snapshot: Snapshot;
  locale: Locale;
  t: Dictionary;
  onBack: () => void;
}) {
  const today = todayJornada();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [selected, setSelected] = useState(today);
  const marked = useMemo(() => eventDatesInMonth(snapshot, year, month), [snapshot, year, month]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const dayEvents = eventsOnDate(snapshot, selected);
  const weekdays = locale === "es" ? WEEKDAYS_ES : WEEKDAYS_EN;

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-forest">
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </button>
      <div>
        <h1 className="text-3xl text-forest">{t.calendarTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.calendarHint}</p>
      </div>

      <section className="rounded-3xl border border-line bg-paper p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label={t.calendarPrev} onClick={() => shiftMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-forest">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <select
              aria-label={t.calendarMonth}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="min-h-10 rounded-xl border border-line bg-cream px-2 text-sm font-semibold text-forest"
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = index + 1;
                const label = new Date(Date.UTC(2026, index, 1)).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { month: "long", timeZone: "UTC" });
                return (
                  <option key={value} value={value}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                );
              })}
            </select>
            <select
              aria-label={t.calendarYear}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="min-h-10 rounded-xl border border-line bg-cream px-2 text-sm font-semibold text-forest"
            >
              {Array.from({ length: 6 }, (_, index) => year - 2 + index).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <button type="button" aria-label={t.calendarNext} onClick={() => shiftMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-forest">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-2 text-center text-xs font-semibold text-muted">{monthLabel(year, month, locale)}</p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
          {weekdays.map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((cell, index) => {
            if (!cell) return <span key={`e-${index}`} className="h-10" />;
            const hasEvent = marked.has(cell.date);
            const isSelected = selected === cell.date;
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date)}
                className={`relative flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition ${
                  isSelected ? "bg-forest text-paper" : isToday ? "bg-gold/20 text-forest" : "text-ink hover:bg-cream"
                }`}
              >
                {cell.day}
                {hasEvent ? (
                  <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-gold" : "bg-forest"}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="text-2xl text-forest">{t.calendarDayTitle}</h2>
        {dayEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t.calendarDayEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dayEvents.map((event) => {
              const style = calendarEventStyle(event.color);
              return (
                <li
                  key={event.id}
                  className="rounded-2xl border border-black/5 px-3 py-2.5"
                  style={{ backgroundColor: style.bg, color: style.fg }}
                >
                  <p className="font-semibold">
                    {event.time ? <span className="mr-2 tabular-nums opacity-80">{event.time}</span> : null}
                    {event.title}
                  </p>
                  {event.description ? <p className="mt-0.5 text-xs opacity-80">{event.description}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
