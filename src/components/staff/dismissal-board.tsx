"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlarmClock, ClipboardList, Undo2 } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { lateCountdownLabel, lateIsOverdue } from "@/lib/bitacora";
import { findStudent, findVehicle, formatTime, studentGrade, studentName, vehiclePhoto } from "@/lib/school";
import type { DemoSession, LatePickup, PickupRequest, PickupStatus, Snapshot, Student } from "@/lib/types";

type Column = "waiting" | "called";

interface BoardItem {
  request: PickupRequest;
  student: Student;
  vehicleLabel: string;
  vehiclePhoto?: string;
  arrivalPhoto?: string;
}

const TONES = {
  waiting: {
    panel: "border-gold/40 bg-gold/10",
    dot: "bg-gold-deep",
    count: "bg-gold/20 text-gold-deep",
    button: "bg-gold-deep text-paper",
  },
  called: {
    panel: "border-forest/30 bg-forest/10",
    dot: "bg-forest",
    count: "bg-forest/15 text-forest",
    button: "bg-forest text-paper",
  },
} as const;

export function DismissalBoard({
  session,
  onLogout,
}: {
  session: DemoSession;
  onLogout: () => void;
}) {
  const { snapshot } = useSnapshot();
  const [showDelivered, setShowDelivered] = useState(false);
  const [showLates, setShowLates] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const staff = snapshot?.staff.find((member) => member.id === session.staffId) ?? snapshot?.staff[0];

  const { waiting, called, delivered } = useMemo(() => {
    if (!snapshot) return { waiting: [], called: [], delivered: [] } as {
      waiting: BoardItem[];
      called: BoardItem[];
      delivered: BoardItem[];
    };
    const toItem = (request: PickupRequest): BoardItem | null => {
      const student = findStudent(snapshot, request.studentId);
      const trip = snapshot.trips.find((item) => item.id === request.tripId);
      if (!student || !trip) return null;
      const vehicle = findVehicle(snapshot, trip.vehicleId);
      return {
        request,
        student,
        vehicleLabel: vehicle?.label ?? "Auto",
        vehiclePhoto: vehiclePhoto(vehicle),
        arrivalPhoto: trip.arrivalPhoto,
      };
    };
    const byArrival = (a: BoardItem, b: BoardItem) =>
      (a.request.arrivedAt ?? a.request.requestedAt).localeCompare(b.request.arrivedAt ?? b.request.requestedAt);

    const build = (predicate: (status: PickupStatus) => boolean) =>
      snapshot.requests
        .filter((request) => predicate(request.status))
        .map(toItem)
        .filter((item): item is BoardItem => Boolean(item))
        .sort(byArrival);

    return {
      waiting: build((status) => status === "arrived"),
      called: build((status) => status === "preparing" || status === "ready"),
      delivered: build((status) => status === "delivered"),
    };
  }, [snapshot]);

  const activeLates = useMemo(
    () =>
      (snapshot?.latePickups ?? [])
        .filter((late) => late.status === "announced" || late.status === "arrived")
        .sort((a, b) => a.etaAt.localeCompare(b.etaAt)),
    [snapshot],
  );
  const overdueCount = activeLates.filter((late) => lateIsOverdue(late, nowMs)).length;

  async function act(requestId: string, action: "advance" | "undo" | "complete") {
    setBusyKey(requestId);
    try {
      await postJson(`/api/requests/${requestId}/status`, { action, staffName: staff?.name });
    } finally {
      setBusyKey(null);
    }
  }

  async function addRandomArrivals() {
    setSimulating(true);
    try {
      await postJson("/api/demo/populate");
    } finally {
      setSimulating(false);
    }
  }

  if (!snapshot) {
    return <p className="p-8 text-muted">Cargando tablero…</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="rounded-lg">
            <BrandRow />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-forest md:text-3xl">Salida</h1>
            <p className="text-xs text-muted">
              {staff?.name} · <Clock />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={addRandomArrivals}
            disabled={simulating}
            className="rounded-full border border-dashed border-gold-deep px-4 py-2 text-sm font-semibold text-gold-deep disabled:opacity-60"
          >
            {simulating ? "…" : "＋ Simular llegadas"}
          </button>
          <Link
            href="/bitacora"
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Bitácora</span>
          </Link>
          {activeLates.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowLates(true)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold tabular-nums ${
                overdueCount > 0
                  ? "border-danger/40 bg-danger/10 text-danger"
                  : "border-gold/50 bg-gold/15 text-gold-deep"
              }`}
            >
              <AlarmClock className="h-4 w-4" />
              Tardes · {activeLates.length}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowDelivered(true)}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold text-muted"
          >
            Entregado · {delivered.length}
          </button>
          <button type="button" onClick={onLogout} className="rounded-full px-3 py-2 text-sm text-muted">
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Section
            id="waiting"
            title="Esperando"
            items={waiting}
            busyKey={busyKey}
            onTap={(id) => act(id, "advance")}
          />
          <Section
            id="called"
            title="Notificados"
            items={called}
            busyKey={busyKey}
            onTap={(id) => act(id, "complete")}
            onUndo={(id) => act(id, "undo")}
          />
        </div>
      </main>

      {showDelivered ? <DeliveredSheet items={delivered} onClose={() => setShowDelivered(false)} /> : null}
      {showLates ? (
        <LateSheet lates={activeLates} snapshot={snapshot} nowMs={nowMs} onClose={() => setShowLates(false)} />
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  items,
  busyKey,
  onTap,
  onUndo,
}: {
  id: Column;
  title: string;
  items: BoardItem[];
  busyKey: string | null;
  onTap: (id: string) => void;
  onUndo?: (id: string) => void;
}) {
  const tone = TONES[id];

  return (
    <section className={`min-w-0 rounded-2xl border p-3 ${tone.panel}`}>
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          <h2 className="font-serif text-xl text-forest">{title}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${tone.count}`}>
          {items.length}
        </span>
      </header>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {items.length === 0 ? (
          <p className="col-span-full rounded-xl bg-paper/70 px-4 py-8 text-center text-sm text-muted">
            {id === "waiting" ? "Nadie en espera." : "Sin notificados."}
          </p>
        ) : (
          items.map((item, index) => (
            <KidCard
              key={item.request.id}
              item={item}
              column={id}
              position={id === "waiting" ? index + 1 : undefined}
              busy={busyKey === item.request.id}
              onTap={() => onTap(item.request.id)}
              onUndo={onUndo ? () => onUndo(item.request.id) : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
}

function KidCard({
  item,
  column,
  position,
  busy,
  onTap,
  onUndo,
}: {
  item: BoardItem;
  column: Column;
  position?: number;
  busy: boolean;
  onTap: () => void;
  onUndo?: () => void;
}) {
  const waiting = column === "waiting";
  const undoable = !waiting && item.request.status === "preparing";
  const tone = TONES[column];

  return (
    <article className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={onTap}
        className="flex w-full flex-col rounded-xl border border-line bg-paper p-3 text-left transition active:scale-[0.98] disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <StudentAvatar student={item.student} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base leading-tight text-forest">{studentName(item.student)}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {studentGrade(item.student, "es")} · {item.vehicleLabel}
            </p>
          </div>
          {position !== undefined ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-deep text-xs font-bold text-paper">
              {position}
            </span>
          ) : null}
        </div>

        <CarImage photo={item.vehiclePhoto} fallback={item.arrivalPhoto} alt={`Auto: ${item.vehicleLabel}`} />

        <span
          className={`mt-2.5 flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold ${tone.button}`}
        >
          {waiting ? "Notificar" : "Entregar"}
        </span>
      </button>

      {undoable && onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:text-ink"
          aria-label="Deshacer"
        >
          <Undo2 className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}

function CarImage({ photo, fallback, alt }: { photo?: string; fallback?: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken || !photo ? fallback : photo;
  if (!src) return null;
  return (
    <div className="mt-2.5 overflow-hidden rounded-lg">
      <Image
        src={src}
        alt={alt}
        width={640}
        height={360}
        unoptimized
        onError={() => setBroken(true)}
        className="h-16 w-full object-cover"
      />
    </div>
  );
}

function DeliveredSheet({ items, onClose }: { items: BoardItem[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-paper p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-forest">Entregados hoy</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            Cerrar
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-muted">Aún no hay entregas confirmadas.</p>
          ) : (
            items.map((item) => (
              <div key={item.request.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
                <div className="flex items-center gap-3">
                  <StudentAvatar student={item.student} size="sm" />
                  <div>
                    <p className="font-medium">{studentName(item.student)}</p>
                    <p className="text-xs text-muted">
                      {item.vehicleLabel} · {item.request.deliveredByStaffName}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted">{formatTime(item.request.deliveredAt)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LateSheet({
  lates,
  snapshot,
  nowMs,
  onClose,
}: {
  lates: LatePickup[];
  snapshot: Snapshot;
  nowMs: number | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-paper p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl text-forest">Tardes de hoy</h2>
            <p className="text-xs text-muted">Gestiona en la oficina. Solo informativo.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            Cerrar
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {lates.length === 0 ? (
            <p className="text-muted">Ningún alumno en retraso.</p>
          ) : null}
          {lates.map((late) => {
            const students = snapshot.students.filter((student) => late.studentIds.includes(student.id));
            const overdue = lateIsOverdue(late, nowMs);
            const countdown = lateCountdownLabel(late, nowMs);
            return (
              <div
                key={late.id}
                className={`rounded-2xl border p-4 ${
                  late.status === "arrived"
                    ? "border-forest/40 bg-forest/5"
                    : overdue
                      ? "border-danger/40 bg-danger/5"
                      : "border-gold/50 bg-gold/10"
                }`}
              >
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
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tabular-nums ${
                          late.status === "arrived"
                            ? "border-forest/30 bg-forest/10 text-forest"
                            : overdue
                              ? "border-danger/40 bg-danger/10 text-danger"
                              : "border-gold/50 bg-gold/15 text-gold-deep"
                        }`}
                      >
                        {countdown ?? `ETA ${formatTime(late.etaAt, "es")}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      Lo trae: {late.pickerRelationEs} · {late.pickerName}
                    </p>
                    <p className="text-xs text-muted tabular-nums">
                      Hora estimada {formatTime(late.etaAt, "es")}
                    </p>
                    {late.note ? (
                      <p className="mt-1 text-sm italic text-muted">&ldquo;{late.note}&rdquo;</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const format = () => new Date().toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
    const id = window.setInterval(() => setTime(format()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{time ?? "--:--"}</>;
}
