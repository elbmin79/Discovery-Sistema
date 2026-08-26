"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Undo2 } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { findStudent, findVehicle, formatTime, studentGrade, studentName } from "@/lib/school";
import type { DemoSession, PickupRequest, PickupStatus, Student } from "@/lib/types";

type Column = "waiting" | "called";

interface BoardItem {
  request: PickupRequest;
  student: Student;
  pickerLine: string;
  vehicleLabel: string;
}

export function DismissalBoard({
  session,
  onLogout,
}: {
  session: DemoSession;
  onLogout: () => void;
}) {
  const { snapshot } = useSnapshot();
  const [activeColumn, setActiveColumn] = useState<Column>("waiting");
  const [showDelivered, setShowDelivered] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
        pickerLine: `${trip.pickerRelationEs} · ${trip.pickerName}`,
        vehicleLabel: trip.method === "walk" ? "Caminando" : (vehicle?.label ?? "Auto"),
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

  async function act(requestId: string, action: "advance" | "undo" | "complete") {
    setBusyKey(requestId);
    try {
      await postJson(`/api/requests/${requestId}/status`, { action, staffName: staff?.name });
    } finally {
      setBusyKey(null);
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
          <Link
            href="/bitacora"
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Bitácora</span>
          </Link>
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
        <div className="flex rounded-full border border-line bg-paper p-1 md:hidden">
          <SegTab active={activeColumn === "waiting"} onClick={() => setActiveColumn("waiting")}>
            Esperando · {waiting.length}
          </SegTab>
          <SegTab active={activeColumn === "called"} onClick={() => setActiveColumn("called")}>
            Llamado · {called.length}
          </SegTab>
        </div>

        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <Column
            id="waiting"
            title="Esperando"
            hint="Papá ya escaneó en la entrada."
            items={waiting}
            visible={activeColumn === "waiting"}
            busyKey={busyKey}
            onTap={(id) => act(id, "advance")}
          />
          <Column
            id="called"
            title="Llamado"
            hint="Toca de nuevo cuando lo entregues."
            items={called}
            visible={activeColumn === "called"}
            busyKey={busyKey}
            onTap={(id) => act(id, "complete")}
            onUndo={(id) => act(id, "undo")}
          />
        </div>
      </main>

      {showDelivered ? (
        <DeliveredSheet
          items={delivered}
          onClose={() => setShowDelivered(false)}
        />
      ) : null}
    </div>
  );
}

function Column({
  id,
  title,
  hint,
  items,
  visible,
  busyKey,
  onTap,
  onUndo,
}: {
  id: Column;
  title: string;
  hint: string;
  items: BoardItem[];
  visible: boolean;
  busyKey: string | null;
  onTap: (id: string) => void;
  onUndo?: (id: string) => void;
}) {
  return (
    <section className={`min-w-0 ${visible ? "block" : "hidden"} md:block`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-forest md:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </div>
        <span className={`text-2xl font-semibold ${id === "waiting" ? "text-gold-deep" : "text-forest"}`}>
          {items.length}
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-3xl bg-paper/70 px-4 py-10 text-center text-muted">
            {id === "waiting" ? "Nadie en espera." : "Aún no has llamado a nadie."}
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
  const isWaiting = column === "waiting";
  const undoable = !isWaiting && item.request.status === "preparing";

  return (
    <article
      className={`relative rounded-3xl border bg-paper p-4 ${
        isWaiting ? "pulse-gold border-gold" : "border-forest"
      }`}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onTap}
        className="w-full text-left disabled:opacity-60"
      >
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <StudentAvatar student={item.student} size="xl" />
            {position !== undefined ? (
              <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-forest text-sm font-bold text-paper">
                {position}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-2xl leading-tight text-forest">
              {studentName(item.student)}
            </p>
            <p className="text-sm text-muted">{studentGrade(item.student, "es")}</p>
            <p className="mt-1 truncate text-sm font-medium text-forest/80">{item.pickerLine}</p>
            <p className="text-xs text-muted">
              {item.vehicleLabel} · {formatTime(item.request.arrivedAt)}
            </p>
          </div>
          <span className="shrink-0 text-2xl text-gold-deep" aria-hidden>
            →
          </span>
        </div>
      </button>

      {undoable && onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-cream text-muted"
          aria-label="Deshacer"
        >
          <Undo2 className="h-5 w-5" />
        </button>
      ) : null}
    </article>
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
                      {item.pickerLine} · {item.request.deliveredByStaffName}
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

function SegTab({
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
      className={`flex-1 rounded-full px-4 py-3 text-base font-semibold ${
        active ? "bg-forest text-paper" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{now.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}</>;
}
