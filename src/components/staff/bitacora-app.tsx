"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, ClipboardList, Download } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StaffLogin } from "@/components/staff/staff-login";
import { StudentAvatar } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import {
  actorLabel,
  buildBitacoraRows,
  buildSummary,
  downloadCsv,
  eventLabel,
  eventsForRequest,
  lateCountdownLabel,
  lateIsOverdue,
  STATUS_LABELS,
  toCsv,
  type BitacoraRow,
} from "@/lib/bitacora";
import { findStudent, formatTime, studentGrade, studentName } from "@/lib/school";
import type { LatePickup, PickupStatus, Snapshot } from "@/lib/types";

type StatusFilter = "all" | "delivered" | "active" | "cancelled";
type Tab = "rows" | "events" | "lates";

const STATUS_TONES: Record<PickupStatus, string> = {
  on_the_way: "border-line bg-paper text-muted",
  arrived: "border-gold/50 bg-gold/15",
  preparing: "border-gold-deep/40 bg-cream-deep",
  ready: "border-forest/25 bg-forest/10",
  delivered: "border-forest/30 bg-forest/15",
  cancelled: "border-danger/30 bg-danger/10",
};

const EVENT_DOT: Record<string, string> = {
  trip_created: "bg-muted",
  arrived: "bg-gold-deep",
  status_changed: "bg-forest-soft",
  delivered: "bg-forest",
  cancelled: "bg-danger",
  late_announced: "bg-gold-deep",
  late_eta_changed: "bg-gold",
  late_cancelled: "bg-danger",
  late_arrived: "bg-forest-soft",
  late_resolved: "bg-forest",
};

export function BitacoraApp() {
  const { session, setSession } = useSession("staff");

  if (!session) {
    return <StaffLogin onSignedIn={setSession} />;
  }

  return <BitacoraBoard staffName={session.name} />;
}

function BitacoraBoard({ staffName }: { staffName: string }) {
  const { snapshot } = useSnapshot();
  const [tab, setTab] = useState<Tab>("rows");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [busyLate, setBusyLate] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => (snapshot ? buildBitacoraRows(snapshot) : []), [snapshot]);
  const summary = useMemo(() => buildSummary(rows), [rows]);

  const activeLates = useMemo(() => {
    return (snapshot?.latePickups ?? [])
      .filter((late) => late.status === "announced" || late.status === "arrived")
      .sort((a, b) => a.etaAt.localeCompare(b.etaAt));
  }, [snapshot]);

  const closedLates = useMemo(() => {
    return (snapshot?.latePickups ?? []).filter((late) => late.status === "resolved" || late.status === "cancelled");
  }, [snapshot]);

  const overdueCount = activeLates.filter((late) => lateIsOverdue(late, nowMs)).length;

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (zoneId && row.student.zoneId !== zoneId) return false;
      if (statusFilter === "delivered") return row.status === "delivered";
      if (statusFilter === "cancelled") return row.status === "cancelled";
      if (statusFilter === "active") {
        return row.status !== "delivered" && row.status !== "cancelled";
      }
      return true;
    });
  }, [rows, zoneId, statusFilter]);

  const events = useMemo(() => {
    if (!snapshot) return [];
    return [...(snapshot.events ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  }, [snapshot]);

  async function actLate(id: string, action: "arrive" | "cancel" | "resolve") {
    setBusyLate(id);
    try {
      await postJson(`/api/late/${id}`, { action, staffName });
    } finally {
      setBusyLate(null);
    }
  }

  if (!snapshot) {
    return <p className="p-8 text-muted">Cargando bitácora…</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="rounded-lg">
            <BrandRow />
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gold-deep" />
            <h1 className="font-serif text-2xl text-forest">Bitácora del día</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(toCsv(filtered, snapshot.latePickups ?? []))}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <Link
            href="/personal"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest"
          >
            Volver al tablero
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-6">
        {activeLates.length > 0 ? (
          <button
            type="button"
            onClick={() => setTab("lates")}
            className={`mb-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${
              overdueCount > 0 ? "border-danger/40 bg-danger/10" : "border-gold/50 bg-gold/15"
            }`}
          >
            <AlarmClock className={`h-5 w-5 shrink-0 ${overdueCount > 0 ? "text-danger" : "text-gold-deep"}`} />
            <p className={`min-w-0 flex-1 text-sm font-semibold ${overdueCount > 0 ? "text-danger" : "text-forest-deep"}`}>
              {overdueCount > 0
                ? `${activeLates.length} retraso${activeLates.length > 1 ? "s" : ""} activo${activeLates.length > 1 ? "s" : ""} · ${overdueCount} fuera de horario`
                : `${activeLates.length} retraso${activeLates.length > 1 ? "s" : ""} activo${activeLates.length > 1 ? "s" : ""}`}
            </p>
            <span className={`shrink-0 text-xs font-semibold ${overdueCount > 0 ? "text-danger" : "text-gold-deep"}`}>
              Ver →
            </span>
          </button>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Entregados" value={String(summary.delivered)} />
          <SummaryCard label="En proceso" value={String(summary.active)} />
          <SummaryCard label="Cancelados" value={String(summary.cancelled)} />
          <SummaryCard
            label="Espera promedio"
            value={summary.averageWait !== undefined ? `${summary.averageWait} min` : "—"}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full border border-line bg-paper p-1">
            <TabButton active={tab === "rows"} onClick={() => setTab("rows")}>
              Recogidas · {filtered.length}
            </TabButton>
            <TabButton active={tab === "lates"} onClick={() => setTab("lates")}>
              Retrasos · {activeLates.length}
            </TabButton>
            <TabButton active={tab === "events"} onClick={() => setTab("events")}>
              Movimientos · {events.length}
            </TabButton>
          </div>

          {tab === "rows" ? (
            <div className="flex flex-wrap gap-2">
              <FilterPill active={zoneId === null} onClick={() => setZoneId(null)}>
                Ambas puertas
              </FilterPill>
              {snapshot.zones.map((zone) => (
                <FilterPill key={zone.id} active={zoneId === zone.id} onClick={() => setZoneId(zone.id)}>
                  {zone.shortEs}
                </FilterPill>
              ))}
              <span className="mx-1 hidden w-px bg-line md:block" />
              {(
                [
                  ["all", "Todo"],
                  ["delivered", "Entregados"],
                  ["active", "En proceso"],
                  ["cancelled", "Cancelados"],
                ] as [StatusFilter, string][]
              ).map(([value, label]) => (
                <FilterPill key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                  {label}
                </FilterPill>
              ))}
            </div>
          ) : null}
        </div>

        {tab === "rows" ? (
          filtered.length === 0 ? (
            <p className="mt-8 rounded-3xl bg-paper/70 px-4 py-10 text-center text-muted">
              Aún no hay solicitudes registradas hoy.
            </p>
          ) : (
            <>
              <div className="mt-4 hidden overflow-hidden rounded-3xl border border-line bg-paper md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
                      <th className="px-4 py-3 font-semibold">Alumno</th>
                      <th className="px-4 py-3 font-semibold">Familia</th>
                      <th className="px-4 py-3 font-semibold">Llegada</th>
                      <th className="px-4 py-3 font-semibold">Entrega</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Entregó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <RowDesktop
                        key={row.requestId}
                        row={row}
                        snapshot={snapshot}
                        expanded={expandedId === row.requestId}
                        onToggle={() =>
                          setExpandedId((current) => (current === row.requestId ? null : row.requestId))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-3 md:hidden">
                {filtered.map((row) => (
                  <RowMobile
                    key={row.requestId}
                    row={row}
                    snapshot={snapshot}
                    expanded={expandedId === row.requestId}
                    onToggle={() =>
                      setExpandedId((current) => (current === row.requestId ? null : row.requestId))
                    }
                  />
                ))}
              </div>
            </>
          )
        ) : tab === "events" ? (
          <div className="mt-4 rounded-3xl border border-line bg-paper p-4 md:p-6">
            {events.length === 0 ? (
              <p className="py-6 text-center text-muted">Aún no hay movimientos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((event) => {
                  const student = event.studentId ? findStudent(snapshot, event.studentId) : undefined;
                  return (
                    <li key={event.id} className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_DOT[event.type]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-forest">
                          {eventLabel(event)}
                          {student ? ` · ${studentName(student)}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {formatTime(event.at)} · {actorLabel(event)}
                          {event.actorName ? ` (${event.actorName})` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeLates.length === 0 && closedLates.length === 0 ? (
              <p className="rounded-3xl bg-paper/70 px-4 py-10 text-center text-muted">
                Sin retrasos hoy. Buen día.
              </p>
            ) : null}

            {activeLates.map((late) => (
              <LateCard
                key={late.id}
                late={late}
                snapshot={snapshot}
                nowMs={nowMs}
                busy={busyLate === late.id}
                onArrive={() => actLate(late.id, "arrive")}
                onCancel={() => actLate(late.id, "cancel")}
                onResolve={() => actLate(late.id, "resolve")}
              />
            ))}

            {closedLates.length > 0 ? (
              <div className="pt-2">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Cerrados hoy
                </p>
                <div className="space-y-2">
                  {closedLates.map((late) => (
                    <LateCard
                      key={late.id}
                      late={late}
                      snapshot={snapshot}
                      nowMs={nowMs}
                      busy={false}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function LateCard({
  late,
  snapshot,
  nowMs,
  busy,
  onArrive,
  onCancel,
  onResolve,
}: {
  late: LatePickup;
  snapshot: Snapshot;
  nowMs: number | null;
  busy: boolean;
  onArrive?: () => void;
  onCancel?: () => void;
  onResolve?: () => void;
}) {
  const students = snapshot.students.filter((student) => late.studentIds.includes(student.id));
  const overdue = lateIsOverdue(late, nowMs);
  const active = late.status === "announced" || late.status === "arrived";
  const countdown = lateCountdownLabel(late, nowMs);

  const chipTone =
    late.status === "arrived"
      ? "border-forest/30 bg-forest/10 text-forest"
      : overdue
        ? "border-danger/40 bg-danger/10 text-danger"
        : late.status === "announced"
          ? "border-gold/50 bg-gold/15 text-gold-deep"
          : "border-line bg-paper text-muted";

  const cardTone =
    late.status === "arrived"
      ? "border-forest/40 bg-paper"
      : overdue
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

      {active && onArrive && onResolve ? (
        <div className="mt-3 flex gap-2">
          {late.status === "announced" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onArrive}
                className="min-h-11 flex-1 rounded-full bg-forest text-sm font-semibold text-paper disabled:opacity-60"
              >
                Marcar llegó
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="min-h-11 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger disabled:opacity-60"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onResolve}
              className="min-h-11 flex-1 rounded-full bg-forest-soft text-sm font-semibold text-paper disabled:opacity-60"
            >
              Cerrar retraso
            </button>
          )}
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
  row: BitacoraRow;
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
        <td className="px-4 py-3 text-muted">{formatTime(row.arrivedAt)}</td>
        <td className="px-4 py-3 text-muted">{formatTime(row.deliveredAt)}</td>
        <td className="px-4 py-3">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-4 py-3 text-muted">{row.deliveredBy ?? "—"}</td>
      </tr>
      {expanded ? (
        <tr className="border-b border-line/60 bg-cream/60">
          <td colSpan={6} className="px-4 py-4">
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
  row: BitacoraRow;
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
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>Llegada: {formatTime(row.arrivedAt)}</span>
        <span>Entrega: {formatTime(row.deliveredAt)}</span>
      </div>
      {row.deliveredBy ? <p className="mt-1 text-xs text-muted">Entregó: {row.deliveredBy}</p> : null}
      {expanded ? <Timeline snapshot={snapshot} row={row} /> : null}
    </article>
  );
}

function Timeline({ snapshot, row }: { snapshot: Snapshot; row: BitacoraRow }) {
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-paper px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">{label}</p>
      <p className="mt-1 font-serif text-3xl text-forest">{value}</p>
    </div>
  );
}

function TabButton({
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
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        active ? "bg-forest text-paper" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
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
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
        active ? "bg-forest text-paper" : "bg-paper text-muted"
      }`}
    >
      {children}
    </button>
  );
}
