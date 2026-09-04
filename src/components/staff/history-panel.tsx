"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, Info, X } from "lucide-react";
import { actorLabel, eventLabel, STATUS_LABELS } from "@/lib/admin-dashboard";
import { isCapturedPhoto, jornadaLabel, resolvePhotoSrc, SCHOOL_TIMEZONE, todayJornada } from "@/lib/school";
import { fallbackArrivalPhoto } from "@/lib/seed/demo-data";
import { validJornada } from "@/lib/history";
import type { HistoryPage, HistoryRow } from "@/lib/types";
import { FilterPill, SummaryCard } from "./admin-dashboard-app";

type Range = "today" | "week" | "month" | "custom";

function daysAgo(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - count);
  return date.toISOString().slice(0, 10);
}

function time(value?: string) {
  return value ? new Date(value).toLocaleTimeString("es-MX", { timeZone: SCHOOL_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "—";
}

async function fetchPage(from: string, to: string, offset: number, signal?: AbortSignal): Promise<HistoryPage> {
  const response = await fetch(`/api/history?from=${from}&to=${to}&limit=200&offset=${offset}`, { cache: "no-store", signal });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "No se pudo cargar el histórico.");
  }
  return response.json();
}

export function HistoryPanel() {
  const [range, setRange] = useState<Range>("today");
  const [today, setToday] = useState(todayJornada);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const closeSelected = useCallback(() => setSelected(null), []);
  const from = range === "custom" ? customFrom : daysAgo(today, range === "week" ? 6 : range === "month" ? 29 : 0);
  const to = range === "custom" ? customTo : today;
  const valid = validJornada(from) && validJornada(to) && from <= to;

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const result = await fetchPage(from, to, offset, controller.signal);
        if (!controller.signal.aborted) { setPage(result); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el histórico.");
      } finally {
        if (range === "today" && !controller.signal.aborted) timeout = setTimeout(() => { setToday(todayJornada()); void load(); }, 2000);
      }
    };
    void load();
    return () => { controller.abort(); if (timeout) clearTimeout(timeout); };
  }, [from, to, offset, range, valid]);

  function changeRange(next: Range) {
    setRange(next); setOffset(0); setPage(null); setError(""); setSelected(null); setToday(todayJornada());
  }

  async function exportRange() {
    setExporting(true);
    try {
      const rows = new Map<string, HistoryRow>();
      for (let start = 0; ; start += 200) {
        const result = await fetchPage(from, to, start);
        result.rows.forEach((row) => rows.set(row.tripId, row));
        if (start + result.rows.length >= result.total || result.rows.length === 0) break;
      }
      const csv = historyCsv([...rows.values()]);
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `historico-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo exportar."); }
    finally { setExporting(false); }
  }

  return <section className="mt-5 space-y-4" aria-label="Histórico de recogidas">
    <div className="flex flex-wrap items-center gap-2">
      {([["today", "Hoy"], ["week", "7 días"], ["month", "30 días"], ["custom", "Personalizado"]] as const).map(([key, label]) => <FilterPill key={key} active={range === key} onClick={() => changeRange(key)}>{label}</FilterPill>)}
      <button className="ml-auto flex min-h-11 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-paper disabled:opacity-50" onClick={() => void exportRange()} disabled={!valid || exporting || !page?.total}><Download size={16} />{exporting ? "Exportando…" : "Exportar histórico CSV"}</button>
    </div>
    {range === "custom" && <div className="flex flex-wrap gap-3">
      <label className="text-sm">Desde<input aria-label="Desde" type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setOffset(0); setPage(null); }} className="ml-2 min-h-11 rounded-xl border border-line bg-paper px-3" /></label>
      <label className="text-sm">Hasta<input aria-label="Hasta" type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setOffset(0); setPage(null); }} className="ml-2 min-h-11 rounded-xl border border-line bg-paper px-3" /></label>
    </div>}
    {!valid ? <p role="alert" className="text-danger">Selecciona un rango de fechas válido.</p> : error ? <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-danger">{error}</p> : !page ? <p role="status" className="p-6 text-muted">Cargando histórico…</p> : <>
      <p className="text-sm text-muted">{range === "today" ? "En vivo · se actualiza cada 2 segundos" : `${from} — ${to}`}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><SummaryCard label="Total de recogidas" value={String(page.summary.total)} /><SummaryCard label="Entregados" value={String(page.summary.delivered)} /><SummaryCard label="Cancelados" value={String(page.summary.cancelled)} /><SummaryCard label="Espera promedio" value={page.summary.averageWait === undefined ? "—" : `${page.summary.averageWait} min`} /></div>
      {page.total === 0 && <p className="rounded-3xl bg-paper p-10 text-center text-muted">No hay recogidas en este rango.</p>}
      {page.days.map((day) => <section key={day.jornada} className="overflow-hidden rounded-3xl border border-line bg-paper">
        <h3 className="border-b border-line px-4 py-4 font-serif text-xl text-forest">{jornadaLabel(day.jornada)} · {day.summary.total} recogidas</h3>
        {day.latePickups.length > 0 && <div className="space-y-2 border-b border-gold/30 bg-gold/10 p-4"><h4 className="font-semibold text-forest">Retrasos · {day.latePickups.length}</h4>{day.latePickups.map((late) => <article key={late.id} className="rounded-2xl bg-paper p-3 text-sm"><strong>{late.studentNames.join(", ")}</strong><p>{late.notice.pickerName} · Hora estimada {time(late.notice.etaAt)} · {late.notice.status === "cancelled" ? "Cancelado" : "Avisado"}</p>{late.notice.note && <p className="text-muted">{late.notice.note}</p>}<p className="text-xs text-muted">Aviso {time(late.notice.createdAt)} · Actualizado {time(late.notice.updatedAt)}</p></article>)}</div>}
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead><tr className="text-muted">{["Alumnos", "Quién recoge", "Auto", "Llegada", "Entrega", "Salida", "Estado", "Detalles"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{day.rows.map((row) => <tr key={row.tripId} className="border-t border-line"><td className="px-3 py-3 font-semibold">{row.studentNames.join(", ")}<span className="block text-xs font-normal text-muted">{row.zoneName}</span></td><td className="px-3 py-3">{row.pickerName}<span className="block text-xs text-muted">{row.pickerRelation}</span></td><td className="px-3 py-3">{row.vehicleLabel}<span className="block text-xs text-muted">{row.plate}</span></td><td className="px-3 tabular-nums">{time(row.arrivedAt)}</td><td className="px-3 tabular-nums">{time(row.deliveredAt)}</td><td className="px-3 tabular-nums">{time(row.departedAt)}</td><td className="px-3"><Status row={row} /></td><td className="px-3"><InfoButton row={row} onClick={() => setSelected(row)} /></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-line md:hidden">{day.rows.map((row) => <article key={row.tripId} className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><strong>{row.studentNames.join(", ")}</strong><InfoButton row={row} onClick={() => setSelected(row)} /></div><p className="text-sm">{row.pickerName} · {row.vehicleLabel}</p><p className="text-xs tabular-nums text-muted">Llegada {time(row.arrivedAt)} · Entrega {time(row.deliveredAt)} · Salida {time(row.departedAt)}</p><Status row={row} /></article>)}</div>
      </section>)}
      {page.total > 200 && <nav aria-label="Páginas del histórico" className="flex items-center justify-between"><button className="min-h-11 rounded-full border border-line px-4 disabled:opacity-40" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 200)); setPage(null); }}>Anterior</button><span className="text-sm tabular-nums">{offset + 1}–{Math.min(offset + 200, page.total)} de {page.total}</span><button className="min-h-11 rounded-full border border-line px-4 disabled:opacity-40" disabled={offset + 200 >= page.total} onClick={() => { setOffset(offset + 200); setPage(null); }}>Siguiente</button></nav>}
    </>}
    {selected && <HistorySheet key={selected.tripId} row={page?.rows.find((row) => row.tripId === selected.tripId) ?? selected} onClose={closeSelected} />}
  </section>;
}

function Status({ row }: { row: HistoryRow }) {
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${row.status === "cancelled" ? "bg-danger/10 text-danger" : row.status === "delivered" ? "bg-forest/10 text-forest" : "bg-gold/20 text-gold-deep"}`}>{STATUS_LABELS[row.status]}{row.live ? " · En vivo" : ""}</span>;
}

function InfoButton({ row, onClick }: { row: HistoryRow; onClick: () => void }) {
  return <button onClick={onClick} aria-label={`Información de ${row.code}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-forest"><Info size={18} /></button>;
}

function HistorySheet({ row, onClose }: { row: HistoryRow; onClose: () => void }) {
  const [failed, setFailed] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    close.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { event.preventDefault(); close.current?.focus(); } };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  const captured = isCapturedPhoto(row.photoPath) && failed === 0;
  const svg = fallbackArrivalPhoto(row.vehicleLabel ?? "Auto", row.vehicleColor);
  const src = failed >= 2 ? svg : failed === 1 ? row.vehiclePhoto ?? svg : (captured ? resolvePhotoSrc(row.photoPath) : row.vehiclePhoto) ?? svg;
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 md:items-center" onClick={onClose}><div role="dialog" aria-modal="true" aria-labelledby="history-detail-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-paper p-6" onClick={(event) => event.stopPropagation()}>
    <div className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-gold-deep">Solicitud {row.code} · {row.jornada}</p><h2 id="history-detail-title" className="mt-1 font-serif text-2xl text-forest">{row.studentNames.join(" y ")}</h2></div><button ref={close} onClick={onClose} aria-label="Cerrar" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line"><X size={18} /></button></div>
    <div className="relative mt-4 overflow-hidden rounded-2xl"><Image src={src} alt="Auto en la entrada" width={960} height={540} unoptimized onError={() => setFailed((value) => Math.min(value + 1, 2))} className="h-52 w-full object-cover md:h-64" /><span className="absolute left-3 top-3 rounded-full bg-forest-deep/90 px-3 py-1 text-xs text-paper">{captured ? `Foto de llegada · ${time(row.arrivedAt)}` : "Foto de referencia del auto"}</span></div>
    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">{[["Quién recoge", `${row.pickerName} · ${row.pickerRelation}`], ["Auto", `${row.vehicleLabel ?? "—"} · ${row.plate ?? ""}`], ["Llegada", time(row.arrivedAt)], ["Entrega", time(row.deliveredAt)], ["Salida", time(row.departedAt)], ["Entregó", row.deliveredBy || "—"]].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl>
    <h3 className="mt-5 font-semibold text-forest">Movimientos</h3><ol className="mt-3 space-y-3">{[...(row.detail?.events ?? [])].sort((a, b) => a.at.localeCompare(b.at)).map((event) => <li key={event.id} className="border-l-2 border-gold pl-3 text-sm"><p>{eventLabel(event)}</p><p className="text-xs text-muted">{time(event.at)} · {event.actorName ?? actorLabel(event)}</p></li>)}</ol>
  </div></div>;
}

export function historyCsv(rows: HistoryRow[]) {
  const escape = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const headers = ["Jornada", "Código", "Alumnos", "Quién recoge", "Parentesco", "Auto", "Placa", "Llegada", "Entrega", "Salida", "Estado", "Entregó", "Espera (min)", "Foto"];
  return [headers, ...rows.map((row) => [row.jornada, row.code, row.studentNames.join("; "), row.pickerName, row.pickerRelation, row.vehicleLabel ?? "", row.plate ?? "", row.arrivedAt ?? "", row.deliveredAt ?? "", row.departedAt ?? "", STATUS_LABELS[row.status], row.deliveredBy ?? "", String(row.waitMinutes ?? ""), row.photoPath?.startsWith("data:") ? "" : row.photoPath ?? ""])].map((line) => line.map(escape).join(",")).join("\r\n");
}
