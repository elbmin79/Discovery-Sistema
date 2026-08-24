"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { STAFF_ACCOUNTS } from "@/lib/auth/accounts";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { canUndo } from "@/lib/pickup-machine";
import { findStudent, findVehicle, findZone, formatTime, studentGrade, studentName } from "@/lib/school";
import type { DemoSession, PickupRequest, PickupStatus, Snapshot } from "@/lib/types";

type Lane = "arrived" | "preparing" | "ready" | "coming";

const LANES: { id: Lane; title: string; hint: string }[] = [
  {
    id: "arrived",
    title: "Acaban de llegar",
    hint: "Papá o mamá ya está en la puerta. Ve por cada alumno.",
  },
  {
    id: "preparing",
    title: "Buscando en el aula",
    hint: "Todavía falta alguien. Cuando llegue a la puerta, márcalo.",
  },
  {
    id: "ready",
    title: "En la puerta",
    hint: "Toda la familia está lista. Entrégala de una vez.",
  },
];

const STUDENT_COPY: Record<
  Exclude<PickupStatus, "cancelled" | "delivered">,
  { badge: string; tone: string }
> = {
  on_the_way: { badge: "El papá viene", tone: "border-line bg-paper text-muted" },
  arrived: { badge: "Sigue en el aula", tone: "border-gold/50 bg-gold/15" },
  preparing: { badge: "Lo están trayendo", tone: "border-gold-deep/40 bg-cream-deep" },
  ready: { badge: "Ya está en la puerta", tone: "border-forest/25 bg-forest/10" },
};

export function StaffBoard({
  session,
  onLogout,
  onSwitch,
}: {
  session: DemoSession;
  onLogout: () => void;
  onSwitch: (session: DemoSession) => void;
}) {
  const { snapshot } = useSnapshot();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingTripId, setConfirmingTripId] = useState<string | null>(null);
  const [confirmingSoloId, setConfirmingSoloId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const allZoneIds = snapshot?.zones.map((zone) => zone.id) ?? ["zone-preschool", "zone-elementary"];
  const [zones, setZones] = useState<string[]>(["zone-preschool", "zone-elementary"]);
  const [showOnTheWay, setShowOnTheWay] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const staff = snapshot?.staff.find((member) => member.id === session.staffId) ?? snapshot?.staff[0];

  const groups = useMemo(() => {
    if (!snapshot) return [];
    const allowed = new Set<PickupStatus>(
      showOnTheWay ? ["arrived", "preparing", "ready", "on_the_way"] : ["arrived", "preparing", "ready"],
    );
    const visible = snapshot.requests.filter((request) => {
      if (!allowed.has(request.status)) return false;
      const student = findStudent(snapshot, request.studentId);
      return Boolean(student && (zones.length === 0 || zones.includes(student.zoneId)));
    });
    return groupByTrip(visible).sort(byArrival(snapshot));
  }, [snapshot, showOnTheWay, zones]);

  const lanes = useMemo(() => {
    const buckets: Record<Lane, PickupRequest[][]> = {
      arrived: [],
      preparing: [],
      ready: [],
      coming: [],
    };
    for (const group of groups) {
      buckets[familyLane(group)].push(group);
    }
    return buckets;
  }, [groups]);

  const delivered = snapshot?.requests.filter((request) => request.status === "delivered") ?? [];
  const comingCount = snapshot
    ? snapshot.requests.filter((request) => {
        const student = findStudent(snapshot, request.studentId);
        return (
          request.status === "on_the_way" &&
          student &&
          (zones.length === 0 || zones.includes(student.zoneId))
        );
      }).length
    : 0;

  function clearSelection() {
    setSelectedId(null);
    setConfirmingTripId(null);
    setConfirmingSoloId(null);
    setMenuOpen(false);
  }

  function toggleSelect(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setConfirmingTripId(null);
    setConfirmingSoloId(null);
  }

  async function advanceStudent(requestId: string) {
    setBusyKey(requestId);
    try {
      await postJson(`/api/requests/${requestId}/status`, {
        action: "advance",
        staffName: staff?.name,
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function undoStudent(requestId: string) {
    setBusyKey(requestId);
    try {
      await postJson(`/api/requests/${requestId}/status`, {
        action: "undo",
        staffName: staff?.name,
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function deliverSolo(requestId: string) {
    if (confirmingSoloId !== requestId) {
      setConfirmingTripId(null);
      setConfirmingSoloId(requestId);
      return;
    }
    setBusyKey(requestId);
    try {
      await postJson(`/api/requests/${requestId}/status`, {
        action: "advance",
        staffName: staff?.name,
      });
      setConfirmingSoloId(null);
    } finally {
      setBusyKey(null);
    }
  }

  async function deliverFamily(tripId: string) {
    if (confirmingTripId !== tripId) {
      setConfirmingSoloId(null);
      setConfirmingTripId(tripId);
      return;
    }
    setBusyKey(`trip-${tripId}`);
    try {
      await postJson(`/api/trips/${tripId}/deliver`, { staffName: staff?.name });
      setConfirmingTripId(null);
      setSelectedId(null);
    } finally {
      setBusyKey(null);
    }
  }

  if (!snapshot) {
    return <p className="p-8 text-muted">Cargando tablero de salida…</p>;
  }

  const doorPills = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setZones(allZoneIds);
        }}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold md:px-4 md:py-2 ${
          zones.length === allZoneIds.length ? "bg-forest text-paper" : "bg-cream text-muted"
        }`}
      >
        Ambas
      </button>
      {snapshot.zones.map((zone) => (
        <button
          key={zone.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setZones([zone.id]);
          }}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold md:px-4 md:py-2 ${
            zones.length === 1 && zones[0] === zone.id ? "bg-forest text-paper" : "bg-cream text-muted"
          }`}
        >
          {zone.shortEs}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-cream" onClick={clearSelection}>
      <header
        className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 md:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <Link href="/" className="rounded-lg">
          <BrandRow />
        </Link>
        <div className="hidden md:block">{doorPills}</div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setShowOnTheWay((open) => !open)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              showOnTheWay ? "bg-gold text-forest-deep" : "border border-line text-forest"
            }`}
          >
            En camino · {comingCount}
          </button>
          <button
            type="button"
            onClick={() => setShowDelivered(true)}
            className="hidden rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest md:inline-flex"
          >
            Entregados hoy
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-2xl bg-cream px-3 py-2 text-right md:px-4"
            >
              <p className="text-sm font-semibold text-forest">{staff?.name}</p>
              <p className="hidden text-xs text-muted sm:block">{staff?.titleEs}</p>
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-line bg-paper p-3">
                <p className="px-2 text-xs text-muted">En turno: {staff?.name}</p>
                <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">
                  Cambiar perfil
                </p>
                {STAFF_ACCOUNTS.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => {
                      onSwitch({
                        role: "staff",
                        name: account.name,
                        username: account.username,
                        staffId: account.staffId,
                      });
                      setMenuOpen(false);
                    }}
                    className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-cream"
                  >
                    {account.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-danger"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="px-4 pt-3 md:hidden" onClick={(event) => event.stopPropagation()}>
        {doorPills}
      </div>

      <div className="mx-auto grid w-full flex-1 gap-4 px-4 pb-24 pt-4 lg:grid-cols-3 lg:items-start lg:px-6 lg:pb-8">
        {LANES.map((lane) => (
          <section key={lane.id} className="min-w-0">
            <div className="mb-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="font-serif text-2xl text-forest lg:text-3xl">{lane.title}</h2>
                <span className="text-lg font-semibold text-gold-deep">{lanes[lane.id].length}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{lane.hint}</p>
            </div>
            <div className="space-y-3">
              {lanes[lane.id].length === 0 ? (
                <p className="rounded-3xl bg-paper/70 px-4 py-8 text-center text-sm text-muted">
                  Nadie en esta etapa.
                </p>
              ) : (
                lanes[lane.id].map((group) => (
                  <FamilyCard
                    key={group[0].tripId}
                    snapshot={snapshot}
                    requests={group}
                    lane={lane.id}
                    selectedId={selectedId}
                    confirming={confirmingTripId === group[0].tripId}
                    confirmingSoloId={confirmingSoloId}
                    busyKey={busyKey}
                    onToggle={toggleSelect}
                    onDeselect={clearSelection}
                    onAdvance={advanceStudent}
                    onUndo={undoStudent}
                    onDeliver={() => deliverFamily(group[0].tripId)}
                    onDeliverSolo={deliverSolo}
                    onCancelConfirm={() => {
                      setConfirmingTripId(null);
                      setConfirmingSoloId(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {showOnTheWay && lanes.coming.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 lg:max-w-none lg:px-6 lg:pb-8">
          <h2 className="font-serif text-2xl text-forest">Vienen en camino</h2>
          <p className="mb-3 text-sm text-muted">Todavía no llegan a la escuela.</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {lanes.coming.map((group) => (
              <FamilyCard
                key={group[0].tripId}
                snapshot={snapshot}
                requests={group}
                lane="coming"
                selectedId={selectedId}
                confirming={false}
                confirmingSoloId={null}
                busyKey={busyKey}
                onToggle={toggleSelect}
                onDeselect={clearSelection}
                onAdvance={advanceStudent}
                onUndo={undoStudent}
                onDeliver={() => undefined}
                onDeliverSolo={() => undefined}
                onCancelConfirm={() => undefined}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper p-3 md:hidden">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowDelivered(true);
          }}
          className="w-full rounded-full border border-line py-3 text-base font-semibold text-forest"
        >
          Entregados hoy · {delivered.length}
        </button>
      </div>

      {showDelivered ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 md:items-center"
          onClick={(event) => {
            event.stopPropagation();
            setShowDelivered(false);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-paper p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl text-forest">Entregados hoy</h2>
              <button type="button" onClick={() => setShowDelivered(false)} className="text-sm text-muted">
                Cerrar
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {delivered.length === 0 ? (
                <p className="text-muted">Aún no hay entregas confirmadas.</p>
              ) : (
                delivered.map((request) => {
                  const student = findStudent(snapshot, request.studentId);
                  if (!student) return null;
                  return (
                    <div key={request.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StudentAvatar student={student} size="sm" />
                        <div>
                          <p className="font-medium">{studentName(student)}</p>
                          <p className="text-xs text-muted">{request.deliveredByStaffName}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted">{formatTime(request.deliveredAt)}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FamilyCard({
  snapshot,
  requests,
  lane,
  selectedId,
  confirming,
  confirmingSoloId,
  busyKey,
  onToggle,
  onDeselect,
  onAdvance,
  onUndo,
  onDeliver,
  onDeliverSolo,
  onCancelConfirm,
}: {
  snapshot: Snapshot;
  requests: PickupRequest[];
  lane: Lane;
  selectedId: string | null;
  confirming: boolean;
  confirmingSoloId: string | null;
  busyKey: string | null;
  onToggle: (id: string) => void;
  onDeselect: () => void;
  onAdvance: (id: string) => void;
  onUndo: (id: string) => void;
  onDeliver: () => void;
  onDeliverSolo: (id: string) => void;
  onCancelConfirm: () => void;
}) {
  const trip = snapshot.trips.find((item) => item.id === requests[0]?.tripId);
  if (!trip) return null;

  const kids = [...requests].sort((a, b) => childOrder(a.status) - childOrder(b.status));
  const names = kidNames(snapshot, kids);
  const waiting = kidNames(
    snapshot,
    kids.filter((request) => request.status !== "ready" && request.status !== "on_the_way"),
  );
  const selectedHere = kids.some((request) => request.id === selectedId);
  const showPhoto = Boolean(trip.arrivalPhoto && (lane === "ready" || selectedHere));
  const vehicle = findVehicle(snapshot, trip.vehicleId);
  const familyBusy = busyKey === `trip-${trip.id}`;

  return (
    <article
      className={`rounded-[28px] border bg-paper p-4 ${
        lane === "arrived" ? "pulse-gold border-gold" : lane === "ready" ? "border-forest" : "border-line"
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-start justify-between gap-3" onClick={onDeselect}>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-gold-deep">Familia</p>
          <h3 className="font-serif text-2xl text-forest">{trip.pickerName}</h3>
          <p className="text-sm text-muted">
            {trip.pickerRelationEs}
            {names.length > 1 ? ` · ${names.length} alumnos` : ""}
            {trip.method === "walk" ? " · Caminando" : vehicle ? ` · ${vehicle.label}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium text-muted">{formatTime(trip.arrivedAt ?? trip.createdAt)}</p>
      </div>

      {lane === "preparing" && waiting.length > 0 ? (
        <p className="mb-3 rounded-2xl bg-cream-deep px-3 py-2 text-sm font-medium text-gold-deep">
          Falta {joinNames(waiting)} en la puerta.
        </p>
      ) : null}

      {showPhoto ? (
        <div className="mb-3">
          <Image
            src={trip.arrivalPhoto!}
            alt={`Quién recoge: ${trip.pickerName}`}
            width={960}
            height={640}
            unoptimized
            className="h-44 w-full rounded-3xl object-cover lg:h-40"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {kids.map((request) => {
          const student = findStudent(snapshot, request.studentId);
          if (!student) return null;
          const zone = findZone(snapshot, student.zoneId);
          const active = selectedId === request.id;
          const copy = STUDENT_COPY[request.status as keyof typeof STUDENT_COPY];
          const action =
            request.status === "arrived"
              ? `Ir por ${student.firstName}`
              : request.status === "preparing"
                ? `Ya llegó ${student.firstName}`
                : null;

          return (
            <div key={request.id} className={`rounded-3xl border p-3 ${copy?.tone ?? "bg-cream"}`}>
              <button
                type="button"
                onClick={() => onToggle(request.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                <StudentAvatar student={student} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-xl text-forest">{studentName(student)}</p>
                  <p className="text-sm text-muted">
                    {studentGrade(student, "es")} · {zone?.shortEs}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-forest">{copy?.badge}</p>
                </div>
              </button>

              {action ? (
                <button
                  type="button"
                  disabled={busyKey === request.id}
                  onClick={() => onAdvance(request.id)}
                  className={`mt-3 min-h-12 w-full rounded-full text-base font-semibold ${
                    request.status === "arrived" ? "bg-gold-deep text-paper" : "bg-forest-soft text-paper"
                  }`}
                >
                  {action}
                </button>
              ) : null}

              {request.status === "ready" && lane === "preparing" ? (
                <div className="mt-2 space-y-2">
                  <p className="text-center text-sm font-medium text-forest">
                    Esperando a {joinNames(waiting.filter((name) => name !== student.firstName))}
                  </p>
                  {confirmingSoloId === request.id ? (
                    <>
                      <p className="text-center text-sm text-danger">
                        ¿Entregar solo a <strong>{student.firstName}</strong>?{" "}
                        {joinNames(waiting.filter((name) => name !== student.firstName))} sigue en proceso.
                      </p>
                      <button
                        type="button"
                        disabled={busyKey === request.id}
                        onClick={() => onDeliverSolo(request.id)}
                        className="min-h-12 w-full rounded-full bg-danger text-base font-semibold text-paper"
                      >
                        Sí, entregar solo a {student.firstName}
                      </button>
                      <button
                        type="button"
                        onClick={onCancelConfirm}
                        className="min-h-10 w-full text-sm text-muted"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busyKey === request.id}
                      onClick={() => onDeliverSolo(request.id)}
                      className="min-h-11 w-full rounded-full border border-danger/40 text-sm font-semibold text-danger"
                    >
                      Entregar solo a {student.firstName}
                    </button>
                  )}
                </div>
              ) : null}

              {active && canUndo(request.status) && lane !== "ready" ? (
                <button
                  type="button"
                  disabled={busyKey === request.id}
                  onClick={() => onUndo(request.id)}
                  className="mt-1 min-h-10 w-full text-sm text-muted"
                >
                  Deshacer
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {lane === "ready" ? (
        <div className="mt-4 space-y-2">
          {confirming ? (
            <>
              <p className="text-center text-sm text-ink">
                ¿Entregar a <strong>{joinNames(names)}</strong> con {trip.pickerName}?
              </p>
              <button
                type="button"
                disabled={familyBusy}
                onClick={onDeliver}
                className="min-h-14 w-full rounded-full bg-forest text-lg font-semibold text-paper"
              >
                Sí, entregar familia
              </button>
              <button type="button" onClick={onCancelConfirm} className="min-h-10 w-full text-sm text-muted">
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={familyBusy}
              onClick={onDeliver}
              className="min-h-14 w-full rounded-full bg-forest text-lg font-semibold text-paper"
            >
              Entregar a {joinNames(names)}
            </button>
          )}
        </div>
      ) : null}

      {lane === "coming" ? (
        <p className="mt-3 text-center text-sm text-muted">Aún no llegan a la puerta.</p>
      ) : null}
    </article>
  );
}

function familyLane(requests: PickupRequest[]): Lane {
  const active = requests.filter((request) => request.status !== "delivered" && request.status !== "cancelled");
  if (active.length === 0) return "ready";
  if (active.every((request) => request.status === "on_the_way")) return "coming";
  const present = active.filter((request) => request.status !== "on_the_way");
  if (present.length === 0) return "coming";
  if (present.every((request) => request.status === "ready")) return "ready";
  if (present.every((request) => request.status === "arrived")) return "arrived";
  return "preparing";
}

function groupByTrip(requests: PickupRequest[]) {
  const groups = new Map<string, PickupRequest[]>();
  for (const request of requests) {
    const current = groups.get(request.tripId) ?? [];
    current.push(request);
    groups.set(request.tripId, current);
  }
  return [...groups.values()];
}

function byArrival(snapshot: Snapshot) {
  return (a: PickupRequest[], b: PickupRequest[]) => {
    const tripA = snapshot.trips.find((trip) => trip.id === a[0]?.tripId);
    const tripB = snapshot.trips.find((trip) => trip.id === b[0]?.tripId);
    const timeA = tripA?.arrivedAt ?? tripA?.createdAt ?? "";
    const timeB = tripB?.arrivedAt ?? tripB?.createdAt ?? "";
    return timeA.localeCompare(timeB);
  };
}

function childOrder(status: PickupStatus) {
  if (status === "arrived") return 0;
  if (status === "preparing") return 1;
  if (status === "on_the_way") return 2;
  return 3;
}

function kidNames(snapshot: Snapshot, requests: PickupRequest[]) {
  return requests
    .map((request) => findStudent(snapshot, request.studentId)?.firstName)
    .filter((name): name is string => Boolean(name));
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) {
    const y = /^[hi]/i.test(names[1]) ? "e" : "y";
    return `${names[0]} ${y} ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
