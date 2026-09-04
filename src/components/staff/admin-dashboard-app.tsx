"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, ClipboardList, Download, Info } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StaffLogin } from "@/components/staff/staff-login";
import { StudentAvatar } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { actorLabel, ARRIVAL_LABELS, DEPARTURE_LABELS, eventLabel, eventsForRequest, lateCountdownLabel, lateIsOverdue, STATUS_LABELS, type AdminRow } from "@/lib/admin-dashboard";
import { formatTime, studentGrade, studentName, todayJornada } from "@/lib/school";
import { validJornada, type HistoryStatusFilter } from "@/lib/history";
import type { HistoryPage, HistoryRow, LatePickup, PickupStatus, Snapshot, Student } from "@/lib/types";
import { HistorySheet, historyCsv } from "./history-panel";

type Range = "today" | "week" | "month" | "custom";
const STATUS_TONES: Record<PickupStatus, string> = { on_the_way: "border-line bg-paper text-muted", arrived: "border-gold/50 bg-gold/15", delivered: "border-forest/30 bg-forest/15", cancelled: "border-danger/30 bg-danger/10" };
const EVENT_DOT: Record<string, string> = { trip_created: "bg-muted", arrived: "bg-gold-deep", status_changed: "bg-forest-soft", delivered: "bg-forest", cancelled: "bg-danger", departed: "bg-forest-deep" };

function daysAgo(day: string, count: number) {
  const date = new Date(day + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() - count); return date.toISOString().slice(0, 10);
}

function dashboardRows(records: HistoryRow[], snapshot: Snapshot): AdminRow[] {
  return records.flatMap((row) => row.studentIds.map((id, index) => {
    const student: Student = snapshot.students.find((item) => item.id === id) ?? { id, firstName: row.studentNames[index] ?? "Alumno", lastName: "", level: "grade-1", group: "", zoneId: "", dismissalTime: "", accent: "#1B4D3E", gender: "m" };
    const request = row.detail?.requests.find((item) => item.studentId === id);
    return { requestId: request?.id ?? row.tripId + id, tripId: row.tripId, student, grade: studentGrade(student, "es"), zoneName: row.zoneName ?? "", pickerName: row.pickerName, pickerRelation: row.pickerRelation, vehicleLabel: row.vehicleLabel ?? "Auto", method: row.method, requestedAt: row.requestedAt, arrivedAt: row.arrivedAt, deliveredAt: request?.deliveredAt ?? row.deliveredAt, departedAt: row.departedAt, arrivalVia: row.arrivalVia, departedVia: row.departedVia, status: request?.status ?? row.status, deliveredBy: request?.deliveredByStaffName ?? row.deliveredBy, waitMinutes: row.waitMinutes };
  }));
}

export function AdminDashboardApp() {
  const { session, setSession } = useSession("staff");
  if (!session?.isAdmin) return <StaffLogin onSignedIn={setSession} adminOnly />;
  return <AdminDashboard staffName={session.name} />;
}

function AdminDashboard({ staffName }: { staffName: string }) {
  const { snapshot } = useSnapshot(false);
  const [catalog, setCatalog] = useState(snapshot);
  const [range, setRange] = useState<Range>("today");
  const [today, setToday] = useState(todayJornada);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [busyLate, setBusyLate] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);
  const closeSelected = useCallback(() => setSelected(null), []);
  const from = range === "custom" ? customFrom : daysAgo(today, range === "week" ? 6 : range === "month" ? 29 : 0);
  const to = range === "custom" ? customTo : today;
  const valid = validJornada(from) && validJornada(to) && from <= to;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/state", { signal: controller.signal, cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("No se pudo cargar el panel."); return response.json(); }).then(setCatalog).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => { const timer = setInterval(() => setNowMs(Date.now()), 15000); return () => clearInterval(timer); }, []);

  const fetchPage = useCallback(async (start: number, signal?: AbortSignal): Promise<HistoryPage> => {
    const response = await fetch('/api/history?from=' + from + '&to=' + to + '&limit=200&offset=' + start + '&status=' + statusFilter + '&zone=' + encodeURIComponent(catalog?.zones.find((zone) => zone.id === zoneId)?.nameEs ?? ''), { cache: "no-store", signal });
    if (!response.ok) throw new Error("No se pudieron cargar las recogidas.");
    return response.json();
  }, [from, to, statusFilter, catalog, zoneId]);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try { const next = await fetchPage(offset, controller.signal); if (!controller.signal.aborted) { setPage(next); setError(""); } }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el panel."); }
      finally { if (range === "today" && !controller.signal.aborted) timer = setTimeout(() => { setToday(todayJornada()); void load(); }, 2000); }
    };
    void load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [fetchPage, offset, range, refresh, valid]);

  const rows = useMemo(() => catalog && page ? dashboardRows(page.rows, catalog) : [], [catalog, page]);
  const filtered = rows.filter((row) => (!zoneId || row.student.zoneId === zoneId) && (statusFilter === "all" || (statusFilter === "active" ? row.status !== "delivered" && row.status !== "cancelled" : row.status === statusFilter)));
  const summary = { delivered: page?.summary.delivered ?? 0, cancelled: page?.summary.cancelled ?? 0, active: (page?.summary.total ?? 0) - (page?.summary.delivered ?? 0) - (page?.summary.cancelled ?? 0), averageWait: page?.summary.averageWait };
  const notices = page?.latePickups ?? [];
  const activeLates = notices.filter((item) => item.jornada === today && item.notice.status === "announced").map((item) => item.notice);
  const pastLates = notices.filter((item) => item.jornada !== today);
  const overdueCount = activeLates.filter((late) => lateIsOverdue(late, nowMs)).length;
  function changeRange(next: Range) { setRange(next); setOffset(0); setPage(null); setToday(todayJornada()); }
  async function actLate(id: string) {
    setBusyLate(id);
    try { await postJson('/api/late/' + id, { action: "cancel", staffName }); setRefresh((value) => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cancelar el aviso."); }
    finally { setBusyLate(null); }
  }
  async function exportRange() {
    setExporting(true);
    try { const records = new Map<string, HistoryRow>(); for (let start = 0; ; start += 200) { const result = await fetchPage(start); result.rows.forEach((row) => records.set(row.tripId, row)); if (start + result.rows.length >= result.total || !result.rows.length) break; }
      const selectedRows = [...records.values()].filter((row) => !zoneId || row.studentIds.some((id) => catalog?.students.some((student) => student.id === id && student.zoneId === zoneId)));
      const url = URL.createObjectURL(new Blob(["\uFEFF", historyCsv(selectedRows)], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = 'recogidas-' + from + '-' + to + '.csv'; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo exportar."); } finally { setExporting(false); }
  }
  if (!catalog) return <p className="p-8 text-muted">{error || "Cargando panel…"}</p>;
  return <div className="flex min-h-dvh flex-col bg-cream">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 md:px-6">
      <div className="flex items-center gap-4"><Link href="/" className="rounded-lg"><BrandRow /></Link><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-gold-deep" /><h1 className="font-serif text-2xl text-forest">Admin Dashboard</h1></div></div>
      <div className="flex items-center gap-2"><button onClick={() => void exportRange()} disabled={!valid || !page?.total || exporting} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"><Download className="h-4 w-4" />{exporting ? "Exportando…" : "Exportar CSV"}</button><Link href="/personal" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest">Volver al tablero</Link></div>
    </header>
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-6">
      {overdueCount > 0 && <button onClick={() => document.getElementById("retrasos")?.scrollIntoView({ behavior: "smooth" })} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-left text-danger"><AlarmClock className="h-5 w-5" /><span className="flex-1 text-sm font-semibold">{overdueCount} retraso{overdueCount > 1 ? "s" : ""} fuera de horario</span><span>Ver ↓</span></button>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><SummaryCard label="Entregados" value={String(summary.delivered)} /><SummaryCard label="En proceso" value={String(summary.active)} /><SummaryCard label="Cancelados" value={String(summary.cancelled)} /><SummaryCard label="Espera promedio" value={summary.averageWait === undefined ? "—" : summary.averageWait + " min"} /></div>
      {(activeLates.length > 0 || pastLates.length > 0) && <section id="retrasos" className="mt-4 scroll-mt-24 rounded-3xl border border-gold/50 bg-gold/10 p-4"><header className="flex items-center justify-between gap-3 px-1"><h2 className="font-serif text-2xl text-forest">Retrasos</h2><span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-sm font-bold text-gold-deep">{activeLates.length + pastLates.length}</span></header><div className="mt-3 grid gap-3 sm:grid-cols-2">{activeLates.map((late) => <LateCard key={late.id} late={late} snapshot={catalog} nowMs={nowMs} busy={busyLate === late.id} onCancel={() => void actLate(late.id)} />)}{pastLates.map((item) => <div key={item.id}><p className="mb-2 text-xs text-muted">{item.jornada}</p><LateCard late={item.notice} snapshot={catalog} nowMs={null} busy={false} /></div>)}</div></section>}
      <div className="mt-5 overflow-x-auto pb-1" aria-label="Filtros de recogidas"><div className="mx-auto flex w-max items-center justify-center gap-3 whitespace-nowrap">
        <div role="group" aria-label="Filtrar por puerta" className="flex shrink-0 gap-1"><FilterPill active={!zoneId} onClick={() => setZoneId(null)}>Ambas puertas</FilterPill>{catalog.zones.map((zone) => <FilterPill key={zone.id} active={zoneId === zone.id} onClick={() => setZoneId(zone.id)}>{zone.shortEs}</FilterPill>)}</div>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />
        <div role="group" aria-label="Filtrar por estado" className="flex shrink-0 gap-1">{([["all", "Todo"], ["delivered", "Entregados"], ["active", "En proceso"], ["cancelled", "Cancelados"]] as const).map(([value,label]) => <FilterPill key={value} active={statusFilter === value} onClick={() => { setStatusFilter(value); setOffset(0); setPage(null); }}>{label}</FilterPill>)}</div>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />
        <div role="group" aria-label="Periodo de consulta" className="flex shrink-0 gap-1">{([["today", "Hoy"], ["week", "7 días"], ["month", "30 días"], ["custom", "Personalizado"]] as const).map(([value,label]) => <FilterPill key={value} active={range === value} onClick={() => changeRange(value)}>{label}</FilterPill>)}</div>
      </div></div>
      {range !== "today" && <p className="mt-2 text-right text-xs text-muted">{from} — {to}</p>}
      {range === "custom" && <div className="mt-3 flex flex-wrap justify-end gap-3"><label className="text-sm">Desde<input aria-label="Desde" type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setOffset(0); setPage(null); }} className="ml-2 min-h-11 rounded-xl border border-line bg-paper px-3" /></label><label className="text-sm">Hasta<input aria-label="Hasta" type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setOffset(0); setPage(null); }} className="ml-2 min-h-11 rounded-xl border border-line bg-paper px-3" /></label></div>}
      {!valid ? <p role="alert" className="mt-4 text-danger">Selecciona un rango de fechas válido.</p> : error ? <p role="alert" className="mt-4 text-danger">{error}</p> : !page ? <p className="p-8 text-muted">Cargando recogidas…</p> : !filtered.length ? <p className="mt-8 rounded-3xl bg-paper/70 px-4 py-10 text-center text-muted">No hay recogidas en este rango.</p> : <>
        <div className="mt-4 hidden overflow-x-auto rounded-3xl border border-line bg-paper md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">{["Alumno", "Familia", "Aviso", "Llegada", "Entrega", "Salida", "Estado", "Entregó", ""].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label || (range === "today" ? <LiveIndicator /> : null)}</th>)}</tr></thead><tbody>{filtered.map((row) => <RowDesktop key={row.requestId} row={row} snapshot={catalog} expanded={false} onToggle={() => setSelected(page.rows.find((item) => item.tripId === row.tripId) ?? null)} />)}</tbody></table></div>
        <div className="mt-4 space-y-3 md:hidden">{range === "today" && <div className="flex justify-end px-4"><LiveIndicator /></div>}{filtered.map((row) => <RowMobile key={row.requestId} row={row} snapshot={catalog} expanded={false} onToggle={() => setSelected(page.rows.find((item) => item.tripId === row.tripId) ?? null)} />)}</div>
      </>}
      {page && page.total > 200 && <nav aria-label="Páginas de recogidas" className="mt-4 flex items-center justify-between"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 200))} className="min-h-11 px-4">Anterior</button><span>{offset + 1}–{Math.min(offset + 200, page.total)} de {page.total}</span><button disabled={offset + 200 >= page.total} onClick={() => setOffset(offset + 200)} className="min-h-11 px-4">Siguiente</button></nav>}
    </main>
    {selected && <HistorySheet key={selected.tripId} row={page?.rows.find((row) => row.tripId === selected.tripId) ?? selected} onClose={closeSelected} />}
  </div>;
}

function LiveIndicator() {
  return <span role="status" aria-label="En vivo" className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[11px] font-medium normal-case tracking-normal text-muted"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />En vivo</span>;
}

function LateCard({
  late,
  snapshot,
  nowMs,
  busy,
  onCancel,
}: {
  late: LatePickup;
  snapshot: Snapshot;
  nowMs: number | null;
  busy: boolean;
  onCancel?: () => void;
}) {
  const students = snapshot.students.filter((student) => late.studentIds.includes(student.id));
  const overdue = lateIsOverdue(late, nowMs);
  const active = late.status === "announced";
  const countdown = lateCountdownLabel(late, nowMs);

  const chipTone = overdue
    ? "border-danger/40 bg-danger/10 text-danger"
    : active
      ? "border-gold/50 bg-gold/15 text-gold-deep"
      : "border-line bg-paper text-muted";

  const cardTone = overdue
    ? "border-danger/40 bg-paper"
    : active
      ? "border-gold/50 bg-paper"
      : "border-line bg-paper/60";

  return (
    <article className={`rounded-3xl border p-4 ${cardTone}`}>
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 -space-x-2">
          {students.map((student) => (
            <StudentAvatar key={student.id} student={student} size="sm" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-serif text-lg text-forest">
              {students.map((student) => student.firstName).join(", ") || "Alumnos"}
            </p>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tabular-nums ${chipTone}`}>
              {countdown ?? `ETA ${formatTime(late.etaAt)}`}
            </span>
          </div>
          <p className="text-xs text-muted">
            Lo trae: {late.pickerRelationEs} · {late.pickerName}
            {late.guestPhone ? ` · ${late.guestPhone}` : ""}
          </p>
          <p className="text-xs text-muted tabular-nums">
            Avisó {formatTime(late.createdAt)} · hora estimada {formatTime(late.etaAt)}
          </p>
          {late.note ? <p className="mt-1 text-sm italic text-muted">&ldquo;{late.note}&rdquo;</p> : null}
        </div>
      </div>

      {active && onCancel ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger disabled:opacity-60"
          >
            Cancelar aviso
          </button>
        </div>
      ) : null}
    </article>
  );
}

function RowDesktop({
  row,
  snapshot,
  expanded,
  onToggle,
}: {
  row: AdminRow;
  snapshot: Snapshot;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-line/60 transition hover:bg-cream/60"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <StudentAvatar student={row.student} size="sm" />
            <div>
              <p className="font-medium text-ink">{studentName(row.student)}</p>
              <p className="text-xs text-muted">{studentGrade(row.student, "es")}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-ink">{row.pickerName}</p>
          <p className="text-xs text-muted">
            {row.pickerRelation} · {row.vehicleLabel}
          </p>
        </td>
        <td className="px-4 py-3 text-muted">{formatTime(row.requestedAt)}</td>
        <td className="px-4 py-3 text-muted">
          {formatTime(row.arrivedAt)}
          {row.arrivalVia ? <span className="block text-[11px]">{ARRIVAL_LABELS[row.arrivalVia]}</span> : null}
        </td>
        <td className="px-4 py-3 text-muted">{formatTime(row.deliveredAt)}</td>
        <td className="px-4 py-3 text-muted">
          {formatTime(row.departedAt)}
          {row.departedVia ? <span className="block text-[11px]">{DEPARTURE_LABELS[row.departedVia]}</span> : null}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-4 py-3 text-muted">{row.deliveredBy ?? "—"}</td><td className="px-3"><button aria-label={"Información de " + row.student.firstName} onClick={(event) => { event.stopPropagation(); onToggle(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-forest"><Info size={18} /></button></td>
      </tr>
      {expanded ? (
        <tr className="border-b border-line/60 bg-cream/60">
          <td colSpan={8} className="px-4 py-4">
            <Timeline snapshot={snapshot} row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RowMobile({
  row,
  snapshot,
  expanded,
  onToggle,
}: {
  row: AdminRow;
  snapshot: Snapshot;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-4" onClick={onToggle}>
      <div className="flex items-center gap-3">
        <StudentAvatar student={row.student} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg text-forest">{studentName(row.student)}</p>
          <p className="text-xs text-muted">
            {studentGrade(row.student, "es")} · {row.zoneName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {row.pickerName} ({row.pickerRelation}) · {row.vehicleLabel}
          </p>
        </div>
        <StatusBadge status={row.status} /><button aria-label={"Información de " + row.student.firstName} onClick={(event) => { event.stopPropagation(); onToggle(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-forest"><Info size={18} /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-muted">
        <span>Aviso: {formatTime(row.requestedAt)}</span>
        <span>Llegada: {formatTime(row.arrivedAt)}</span>
        <span>Entrega: {formatTime(row.deliveredAt)}</span>
        <span>Salida: {formatTime(row.departedAt)}</span>
      </div>
      {row.deliveredBy ? <p className="mt-1 text-xs text-muted">Entregó: {row.deliveredBy}</p> : null}
      {expanded ? <Timeline snapshot={snapshot} row={row} /> : null}
    </article>
  );
}

function Timeline({ snapshot, row }: { snapshot: Snapshot; row: AdminRow }) {
  const request = snapshot.requests.find((item) => item.id === row.requestId);
  if (!request) return null;
  const events = eventsForRequest(snapshot, request);

  if (events.length === 0) {
    return <p className="text-sm text-muted">Sin movimientos registrados para esta solicitud.</p>;
  }

  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_DOT[event.type]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{eventLabel(event)}</p>
            <p className="text-xs text-muted">
              {formatTime(event.at)} · {actorLabel(event)}
              {event.actorName ? ` (${event.actorName})` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }: { status: PickupStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-forest ${STATUS_TONES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-paper px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">{label}</p>
      <p className="mt-1 font-serif text-3xl text-forest">{value}</p>
    </div>
  );
}

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-semibold ${
        active ? "bg-forest text-paper" : "bg-paper text-muted"
      }`}
    >
      {children}
    </button>
  );
}
