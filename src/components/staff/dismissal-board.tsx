"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlarmClock, ClipboardList, Info, Undo2, Users, X } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { lateCountdownLabel, lateIsOverdue } from "@/lib/bitacora";
import { arrivalPicture, findStudent, findVehicle, formatTime, studentGrade, studentName } from "@/lib/school";
import type {
  DemoSession,
  Guardian,
  LatePickup,
  PickupRequest,
  PickupStatus,
  PickupTrip,
  Snapshot,
  Student,
  Vehicle,
} from "@/lib/types";

type Column = "waiting" | "called";

interface Kid {
  request: PickupRequest;
  student: Student;
  /** Tutor dueño del alumno cuando lo pide una familia amiga. */
  owner?: Guardian;
}

/** Una tarjeta = una familia (viaje). Puede traer uno o varios hermanos. */
interface FamilyCard {
  trip: PickupTrip;
  kids: Kid[];
  vehicle?: Vehicle;
  vehicleLabel: string;
  picture: ReturnType<typeof arrivalPicture>;
  arrivedAt?: string;
  sortKey: string;
  denied: boolean;
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

function groupByFamily(snapshot: Snapshot, predicate: (status: PickupStatus) => boolean): FamilyCard[] {
  const byTrip = new Map<string, FamilyCard>();

  for (const request of snapshot.requests) {
    if (!predicate(request.status)) continue;
    const student = findStudent(snapshot, request.studentId);
    const trip = snapshot.trips.find((item) => item.id === request.tripId);
    if (!student || !trip) continue;

    let card = byTrip.get(trip.id);
    if (!card) {
      const vehicle = findVehicle(snapshot, trip.vehicleId);
      card = {
        trip,
        kids: [],
        vehicle,
        vehicleLabel: trip.method === "walk" ? "A pie" : (vehicle?.label ?? "Auto"),
        picture: arrivalPicture(trip, vehicle),
        arrivedAt: trip.arrivedAt ?? request.arrivedAt,
        sortKey: request.arrivedAt ?? request.requestedAt,
        denied: false,
      };
      byTrip.set(trip.id, card);
    }
    const owner = request.authorization
      ? snapshot.guardians.find((item) => item.id === request.authorization?.ownerGuardianId)
      : undefined;
    card.kids.push({ request, student, owner });
    if (request.authorization?.status === "denied") card.denied = true;
    const key = request.arrivedAt ?? request.requestedAt;
    if (key < card.sortKey) card.sortKey = key;
  }

  return [...byTrip.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function DismissalBoard({
  session,
  onLogout,
}: {
  session: DemoSession;
  onLogout: () => void;
}) {
  const { snapshot } = useSnapshot();
  const [showDelivered, setShowDelivered] = useState(false);
  const [infoTripId, setInfoTripId] = useState<string | null>(null);
  const [confirmTripId, setConfirmTripId] = useState<string | null>(null);
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
    if (!snapshot) {
      return { waiting: [], called: [], delivered: [] } as {
        waiting: FamilyCard[];
        called: FamilyCard[];
        delivered: Kid[];
      };
    }
    const deliveredKids: Kid[] = snapshot.requests
      .filter((request) => request.status === "delivered")
      .map((request) => {
        const student = findStudent(snapshot, request.studentId);
        return student ? { request, student } : null;
      })
      .filter((kid): kid is Kid => Boolean(kid))
      .sort((a, b) => (b.request.deliveredAt ?? "").localeCompare(a.request.deliveredAt ?? ""));

    return {
      waiting: groupByFamily(snapshot, (status) => status === "arrived"),
      called: groupByFamily(snapshot, (status) => status === "preparing" || status === "ready"),
      delivered: deliveredKids,
    };
  }, [snapshot]);

  const allCards = useMemo(() => [...waiting, ...called], [waiting, called]);
  const infoCard = allCards.find((card) => card.trip.id === infoTripId) ?? null;
  const confirmCard = allCards.find((card) => card.trip.id === confirmTripId) ?? null;

  const activeLates = useMemo(
    () =>
      (snapshot?.latePickups ?? [])
        .filter((late) => late.status === "announced" || late.status === "arrived")
        .sort((a, b) => a.etaAt.localeCompare(b.etaAt)),
    [snapshot],
  );
  const overdueCount = activeLates.filter((late) => lateIsOverdue(late, nowMs)).length;

  async function actFamily(tripId: string, action: "advance" | "undo" | "complete") {
    setBusyKey(tripId);
    try {
      await postJson(`/api/trips/${tripId}/status`, { action, staffName: staff?.name });
    } finally {
      setBusyKey(null);
    }
  }

  function requestComplete(card: FamilyCard) {
    if (card.denied) {
      setConfirmTripId(card.trip.id);
      return;
    }
    void actFamily(card.trip.id, "complete");
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

  const deliveredVehicle = (kid: Kid) => {
    const trip = snapshot.trips.find((item) => item.id === kid.request.tripId);
    return findVehicle(snapshot, trip?.vehicleId)?.label ?? "Auto";
  };

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
            cards={waiting}
            busyKey={busyKey}
            onTap={(card) => actFamily(card.trip.id, "advance")}
            onInfo={(card) => setInfoTripId(card.trip.id)}
          />
          <Section
            id="called"
            title="Notificados"
            cards={called}
            busyKey={busyKey}
            onTap={requestComplete}
            onUndo={(card) => actFamily(card.trip.id, "undo")}
            onInfo={(card) => setInfoTripId(card.trip.id)}
          />
        </div>

        <div className="mt-auto flex justify-end pt-2">
          <button
            type="button"
            onClick={addRandomArrivals}
            disabled={simulating}
            className="rounded-full border border-dashed border-line px-3 py-1.5 text-xs text-muted transition hover:border-gold-deep hover:text-gold-deep disabled:opacity-60"
            title="Solo para la demo: agrega familias que acaban de llegar."
          >
            {simulating ? "Simulando…" : "＋ Simular llegadas"}
          </button>
        </div>
      </main>

      {showDelivered ? (
        <DeliveredSheet items={delivered} vehicleOf={deliveredVehicle} onClose={() => setShowDelivered(false)} />
      ) : null}
      {showLates ? (
        <LateSheet lates={activeLates} snapshot={snapshot} nowMs={nowMs} onClose={() => setShowLates(false)} />
      ) : null}
      {infoCard ? <InfoSheet card={infoCard} snapshot={snapshot} onClose={() => setInfoTripId(null)} /> : null}
      {confirmCard ? (
        <ConfirmDeniedSheet
          card={confirmCard}
          busy={busyKey === confirmCard.trip.id}
          onCancel={() => setConfirmTripId(null)}
          onConfirm={async () => {
            await actFamily(confirmCard.trip.id, "complete");
            setConfirmTripId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  cards,
  busyKey,
  onTap,
  onUndo,
  onInfo,
}: {
  id: Column;
  title: string;
  cards: FamilyCard[];
  busyKey: string | null;
  onTap: (card: FamilyCard) => void;
  onUndo?: (card: FamilyCard) => void;
  onInfo: (card: FamilyCard) => void;
}) {
  const tone = TONES[id];
  const kidCount = cards.reduce((sum, card) => sum + card.kids.length, 0);

  return (
    <section className={`min-w-0 rounded-2xl border p-3 ${tone.panel}`}>
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          <h2 className="font-serif text-xl text-forest">{title}</h2>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${tone.count}`}>
          {kidCount}
        </span>
      </header>

      <div className="@container">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {cards.length === 0 ? (
            <p className="col-span-full rounded-xl bg-paper/70 px-4 py-8 text-center text-sm text-muted">
              {id === "waiting" ? "Nadie en espera." : "Sin notificados."}
            </p>
          ) : (
            cards.map((card, index) => (
              <FamilyCardView
                key={card.trip.id}
                card={card}
                column={id}
                position={id === "waiting" ? index + 1 : undefined}
                busy={busyKey === card.trip.id}
                onTap={() => onTap(card)}
                onUndo={onUndo ? () => onUndo(card) : undefined}
                onInfo={() => onInfo(card)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ownerLabel(kid: Kid) {
  if (!kid.owner) return "";
  const relation = kid.owner.relationEs.toLowerCase();
  const article = /^(mam|abuel|tí)a/.test(relation) ? "La" : "El";
  return `${article} ${relation} de ${kid.student.firstName}`;
}

function FamilyCardView({
  card,
  column,
  position,
  busy,
  onTap,
  onUndo,
  onInfo,
}: {
  card: FamilyCard;
  column: Column;
  position?: number;
  busy: boolean;
  onTap: () => void;
  onUndo?: () => void;
  onInfo: () => void;
}) {
  const waiting = column === "waiting";
  const siblings = card.kids.length > 1;
  const undoable = !waiting && card.kids.some((kid) => kid.request.status === "preparing");
  const tone = TONES[column];
  const verb = waiting ? "Notificar" : "Entregar";
  const label = siblings ? `${verb} a los ${card.kids.length}` : verb;
  const deniedKids = card.kids.filter((kid) => kid.request.authorization?.status === "denied");
  const pendingKids = card.kids.filter((kid) => kid.request.authorization?.status === "pending");

  const frame = card.denied
    ? "border-danger bg-danger/5 shadow-[inset_4px_0_0_0_var(--color-danger)]"
    : siblings
      ? "border-gold/60 shadow-[inset_4px_0_0_0_var(--color-gold)]"
      : "border-line";

  return (
    <article className={`relative ${siblings ? "@md:col-span-2" : ""}`}>
      <button
        type="button"
        disabled={busy}
        onClick={onTap}
        className={`flex w-full flex-col rounded-xl border bg-paper p-3 pt-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${frame}`}
      >
        {siblings ? (
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-gold-deep">
            <Users className="h-3.5 w-3.5" />
            Hermanos · mismo auto
          </p>
        ) : null}

        <div className={siblings ? "grid gap-3 @md:grid-cols-2" : ""}>
          {card.kids.map((kid) => (
            <div key={kid.request.id} className="flex items-center gap-3">
              <StudentAvatar student={kid.student} size="xl" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl leading-tight text-forest">{kid.student.firstName}</p>
                <p className="truncate text-sm text-muted">{kid.student.lastName}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{studentGrade(kid.student, "es")}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">
            {card.trip.pickerRelationEs} · {card.trip.pickerName}
          </span>
          {position !== undefined ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-deep text-xs font-bold text-paper">
              {position}
            </span>
          ) : null}
        </p>

        {deniedKids.length > 0 ? (
          <p className="mt-2 rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold leading-snug text-paper">
            {deniedKids.map((kid) => `${ownerLabel(kid)} dijo que no`).join(" · ")}
          </p>
        ) : pendingKids.length > 0 ? (
          <p className="mt-2 text-[11px] text-muted">
            Hijo de familia amiga · sin respuesta{pendingKids.length > 1 ? "s" : ""} aún
          </p>
        ) : null}
        {card.trip.unannounced ? (
          <p className="mt-2 inline-flex self-start rounded-full border border-dashed border-gold-deep/60 px-2 py-0.5 text-[10px] font-semibold text-gold-deep">
            Llegó sin aviso
          </p>
        ) : null}

        <span
          className={`mt-3 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold ${
            card.denied && !waiting ? "bg-danger text-paper" : tone.button
          }`}
        >
          {label}
        </span>
      </button>

      <div className="absolute right-2 top-2 flex gap-1.5">
        {undoable && onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:text-ink"
            aria-label="Deshacer"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onInfo}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:text-forest"
          aria-label="Más información"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Sheet({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-3xl bg-paper p-6 ${wide ? "max-w-2xl" : "max-w-xl"}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function InfoSheet({ card, snapshot, onClose }: { card: FamilyCard; snapshot: Snapshot; onClose: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = broken || !card.picture.src ? card.picture.fallback : card.picture.src;
  const captured = card.picture.captured && !broken;
  const requester = snapshot.guardians.find((item) => item.id === card.trip.guardianId);
  const via =
    card.trip.arrivalVia === "tag"
      ? `Tag ${card.vehicle?.tagId ?? ""}`
      : card.trip.arrivalVia === "qr"
        ? "QR en kiosco"
        : card.trip.arrivalVia === "code"
          ? "Código en kiosco"
          : "Kiosco";

  return (
    <Sheet onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-gold-deep">Solicitud {card.trip.code}</p>
          <h2 className="mt-1 font-serif text-2xl text-forest">
            {card.kids.map((kid) => kid.student.firstName).join(" y ")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {src ? (
        <div className="relative mt-4 overflow-hidden rounded-2xl">
          <Image src={src} alt="Auto en la entrada" width={960} height={540} unoptimized onError={() => setBroken(true)} className="h-52 w-full object-cover md:h-64" />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-forest-deep/80 px-2.5 py-1 text-xs font-semibold text-paper">
            <span className={`h-2 w-2 rounded-full ${captured ? "bg-emerald-400" : "bg-gold"}`} />
            {captured ? `Foto de llegada · ${formatTime(card.arrivedAt)}` : "Foto de referencia del auto"}
          </span>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <Field label="Quién recoge">
          {card.trip.pickerRelationEs} · <strong>{card.trip.pickerName}</strong>
          {requester && requester.phone ? <span className="block text-muted">{requester.phone}</span> : null}
        </Field>
        <Field label="Llegada">
          {formatTime(card.arrivedAt)} · {via}
          {card.trip.unannounced ? <span className="block text-gold-deep">Sin aviso previo</span> : null}
        </Field>
        <Field label="Auto">
          {card.vehicleLabel}
          {card.vehicle?.plate ? <span className="text-muted"> · {card.vehicle.plate}</span> : null}
          {card.vehicle?.tagId ? <span className="block font-mono text-xs text-muted">Tag {card.vehicle.tagId}</span> : null}
        </Field>
        <Field label="Solicitó desde la app">
          {requester ? `${requester.firstName} ${requester.lastName}` : card.trip.pickerName}
        </Field>
      </dl>

      <div className="mt-5 space-y-2">
        {card.kids.map((kid) => {
          const auth = kid.request.authorization;
          return (
            <div key={kid.request.id} className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
              <StudentAvatar student={kid.student} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{studentName(kid.student)}</p>
                <p className="text-xs text-muted">{studentGrade(kid.student, "es")}</p>
              </div>
              {auth ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    auth.status === "denied"
                      ? "bg-danger text-paper"
                      : auth.status === "approved"
                        ? "bg-forest/10 text-forest"
                        : "bg-gold/20 text-gold-deep"
                  }`}
                >
                  {auth.status === "denied"
                    ? `${ownerLabel(kid)} dijo que no`
                    : auth.status === "approved"
                      ? `Confirmado por ${kid.owner?.firstName ?? "la familia"}`
                      : `Sin respuesta de ${kid.owner?.firstName ?? "la familia"}`}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] uppercase text-gold-deep">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

function ConfirmDeniedSheet({
  card,
  busy,
  onCancel,
  onConfirm,
}: {
  card: FamilyCard;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const denied = card.kids.filter((kid) => kid.request.authorization?.status === "denied");
  return (
    <Sheet onClose={onCancel}>
      <p className="text-xs tracking-[0.18em] uppercase text-danger">Atención</p>
      <h2 className="mt-1 font-serif text-2xl text-forest">
        {denied.map((kid) => ownerLabel(kid)).join(" y ")} {denied.length > 1 ? "dijeron" : "dijo"} que no
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        La familia de {denied.map((kid) => kid.student.firstName).join(" y ")} no confirmó que{" "}
        {card.trip.pickerName} pueda recogerlos hoy. Puede ser un error; verifica con la familia antes de entregar.
      </p>
      <div className="mt-6 grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-full bg-danger py-3.5 text-base font-semibold text-paper disabled:opacity-60"
        >
          Verifiqué con la familia · Entregar
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-line py-3 text-sm font-semibold text-forest">
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}

function DeliveredSheet({
  items,
  vehicleOf,
  onClose,
}: {
  items: Kid[];
  vehicleOf: (kid: Kid) => string;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
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
                    {vehicleOf(item)} · {item.request.deliveredByStaffName}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted">{formatTime(item.request.deliveredAt)}</p>
            </div>
          ))
        )}
      </div>
    </Sheet>
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
