"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { CalendarDays, ChevronLeft, ChevronRight, Megaphone, Trash2 } from "lucide-react";
import { postJson } from "@/hooks/use-snapshot";
import { buildMonthGrid, calendarEventStyle, CALENDAR_EVENT_COLORS, eventDatesInMonth, eventsOnDate, monthLabel, sortedAnnouncements } from "@/lib/school-comms";
import { formatTime, todayJornada } from "@/lib/school";
import type { CalendarEventColor, Snapshot } from "@/lib/types";

type SchoolTab = "announcements" | "calendar";

export function AdminSchoolPanel({
  snapshot,
  onSnapshot,
}: {
  snapshot: Snapshot;
  onSnapshot: (next: Snapshot) => void;
}) {
  const [tab, setTab] = useState<SchoolTab>("announcements");
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabPill active={tab === "announcements"} onClick={() => setTab("announcements")} icon={<Megaphone className="h-4 w-4" />}>
          Avisos
        </TabPill>
        <TabPill active={tab === "calendar"} onClick={() => setTab("calendar")} icon={<CalendarDays className="h-4 w-4" />}>
          Calendario
        </TabPill>
      </div>
      {tab === "announcements" ? (
        <AdminAnnouncements snapshot={snapshot} onSnapshot={onSnapshot} />
      ) : (
        <AdminCalendar snapshot={snapshot} onSnapshot={onSnapshot} />
      )}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
        active ? "bg-forest text-paper" : "border border-line bg-paper text-forest"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function AdminAnnouncements({
  snapshot,
  onSnapshot,
}: {
  snapshot: Snapshot;
  onSnapshot: (next: Snapshot) => void;
}) {
  const list = sortedAnnouncements(snapshot);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const next = await postJson<Snapshot>("/api/school/announcements", { title, subtitle, body, photoUrl });
      onSnapshot(next);
      setTitle("");
      setSubtitle("");
      setBody("");
      setPhotoUrl(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      onSnapshot(await postJson<Snapshot>(`/api/school/announcements/${id}`, { action: "delete" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        className="rounded-3xl border border-line bg-paper p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <h2 className="font-serif text-2xl text-forest">Nuevo aviso</h2>
        <p className="mt-1 text-sm text-muted">Los papás lo verán como notificación hasta que lo abran.</p>
        <label className="mt-4 block text-sm font-semibold text-forest">
          Título
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-forest">
          Subtítulo (opcional)
          <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-forest">
          Descripción
          <textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-forest">
          Foto / flyer (opcional)
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm text-muted"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                setPhotoUrl(undefined);
                return;
              }
              if (file.size > 1_800_000) {
                setError("La imagen debe pesar menos de 1.8 MB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPhotoUrl(typeof reader.result === "string" ? reader.result : undefined);
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {photoUrl ? (
          <div className="relative mt-3 overflow-hidden rounded-2xl border border-line">
            <Image src={photoUrl} alt="" width={640} height={360} unoptimized className="h-40 w-full object-cover" />
            <button type="button" onClick={() => setPhotoUrl(undefined)} className="absolute top-2 right-2 rounded-full bg-paper/90 px-2 py-1 text-xs font-semibold text-danger">
              Quitar
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-4 min-h-11 w-full rounded-full bg-forest text-sm font-semibold text-paper disabled:opacity-60">
          {busy ? "Publicando…" : "Publicar aviso"}
        </button>
      </form>

      <div className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Publicados · {list.length}</h2>
        <div className="mt-4 space-y-2">
          {list.length === 0 ? <p className="text-sm text-muted">Aún no hay avisos.</p> : null}
          {list.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-cream/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-forest">{item.title}</p>
                  {item.subtitle ? <p className="text-xs text-muted">{item.subtitle}</p> : null}
                  <p className="mt-1 line-clamp-2 text-sm text-ink">{item.body}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatTime(item.createdAt)}{item.authorName ? ` · ${item.authorName}` : ""}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => void remove(item.id)} className="rounded-full p-2 text-danger hover:bg-danger/10" aria-label="Eliminar aviso">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminCalendar({
  snapshot,
  onSnapshot,
}: {
  snapshot: Snapshot;
  onSnapshot: (next: Snapshot) => void;
}) {
  const today = todayJornada();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [color, setColor] = useState<CalendarEventColor>("forest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const marked = useMemo(() => eventDatesInMonth(snapshot, year, month), [snapshot, year, month]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const dayEvents = eventsOnDate(snapshot, selected);

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const next = await postJson<Snapshot>("/api/school/calendar", {
        title,
        description,
        date: selected,
        time: time || undefined,
        color,
      });
      onSnapshot(next);
      setTitle("");
      setDescription("");
      setTime("");
      setColor("forest");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      onSnapshot(await postJson<Snapshot>(`/api/school/calendar/${id}`, { action: "delete" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-serif text-xl text-forest">{monthLabel(year, month, "es")}</p>
          <button type="button" onClick={() => shiftMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
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
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date)}
                className={`relative flex h-10 items-center justify-center rounded-xl text-sm font-semibold ${
                  isSelected ? "bg-forest text-paper" : "text-ink hover:bg-cream"
                }`}
              >
                {cell.day}
                {hasEvent ? <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-gold" : "bg-forest"}`} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl text-forest">Evento · {selected}</h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block text-sm font-semibold text-forest">
            Título
            <input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3" />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Hora (opcional)
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-cream px-3" />
          </label>
          <label className="block text-sm font-semibold text-forest">
            Descripción (opcional)
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2" />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-forest">Color</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CALENDAR_EVENT_COLORS.map((option) => {
                const active = color === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={active}
                    onClick={() => setColor(option.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                      active ? "border-forest scale-105" : "border-transparent"
                    }`}
                    style={{ backgroundColor: option.swatch }}
                  >
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">{calendarEventStyle(color).label}</p>
          </fieldset>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" disabled={busy} className="min-h-11 w-full rounded-full bg-forest text-sm font-semibold text-paper disabled:opacity-60">
            {busy ? "Guardando…" : "Agregar al calendario"}
          </button>
        </form>
        <div className="mt-5 space-y-2 border-t border-line pt-4">
          {dayEvents.length === 0 ? <p className="text-sm text-muted">Sin eventos este día.</p> : null}
          {dayEvents.map((event) => {
            const style = calendarEventStyle(event.color);
            return (
              <article
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line px-3 py-3"
                style={{ backgroundColor: style.bg, color: style.fg }}
              >
                <div>
                  <p className="font-semibold">
                    {event.time ? <span className="mr-2 tabular-nums opacity-80">{event.time}</span> : null}
                    {event.title}
                  </p>
                  {event.description ? <p className="text-xs opacity-80">{event.description}</p> : null}
                </div>
                <button type="button" disabled={busy} onClick={() => void remove(event.id)} className="rounded-full p-2 text-danger hover:bg-danger/10" aria-label="Eliminar evento">
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
