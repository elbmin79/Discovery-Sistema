"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlarmClock, Car, ClipboardList, Info, Undo2, Users, X } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { lateCountdownLabel, lateIsOverdue } from "@/lib/admin-dashboard";
import { DELIVERED_VISIBLE_MS } from "@/lib/pickup-machine";
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

type Column = "waiting" | "notified";

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
  /** Última entrega de la familia; ordena la lista de Notificados. */
  deliveredAt?: string;
  sortKey: string;
  denied: boolean;
}

const TONES = {
  waiting: {
    panel: "border-gold/40 bg-gold/10",
    dot: "bg-gold-deep",
    count: "bg-gold/20 text-gold-deep",
    button: "bg-forest text-paper",
  },
  notified: {
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
    if (request.deliveredAt && (!card.deliveredAt || request.deliveredAt > card.deliveredAt)) {
      card.deliveredAt = request.deliveredAt;
    }
  }

  return [...byTrip.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** Familias ya entregadas que siguen en "Notificados": no han salido y la entrega es reciente. */
function notifiedFamilies(snapshot: Snapshot, nowMs: number): FamilyCard[] {
  return groupByFamily(snapshot, (status) => status === "delivered")
    .filter((card) => {
      if (card.trip.departedAt || !card.deliveredAt) return false;
      return nowMs - Date.parse(card.deliveredAt) < DELIVERED_VISIBLE_MS;
    })
    .sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? ""));
}

export function DismissalBoard({
  session,
  onLogout,
}: {
  session: DemoSession;
  onLogout: () => void;
}) {
  const { snapshot } = useSnapshot();
  const [infoTripId, setInfoTripId] = useState<string | null>(null);
  const [notifiedTripId, setNotifiedTripId] = useState<string | null>(null);
  const [confirmTripId, setConfirmTripId] = useState<string | null>(null);
  const [showLates, setShowLates] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    // Primer tick inmediato para que la lista de Notificados no espere 15 s en aparecer.
    const first = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const staff = snapshot?.staff.find((member) => member.id === session.staffId) ?? snapshot?.staff[0];

  const waiting = useMemo(
    () => (snapshot ? groupByFamily(snapshot, (status) => status === "arrived") : []),
    [snapshot],
  );
  const notified = useMemo(
    () => (snapshot && nowMs ? notifiedFamilies(snapshot, nowMs) : []),
    [snapshot, nowMs],
  );

  const infoCard = waiting.find((card) => card.trip.id === infoTripId) ?? null;
  const notifiedCard = notified.find((card) => card.trip.id === notifiedTripId) ?? null;
  const confirmCard = waiting.find((card) => card.trip.id === confirmTripId) ?? null;

  const activeLates = useMemo(
    () =>
      (snapshot?.latePickups ?? [])
        .filter((late) => late.status === "announced")
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

  async function closeFamily(tripId: string) {
    setBusyKey(tripId);
    try {
      await postJson(`/api/trips/${tripId}/depart`, { via: "staff", staffName: staff?.name });
      setNotifiedTripId(null);
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
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
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
          <button type="button" onClick={onLogout} className="rounded-full px-3 py-2 text-sm text-muted">
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(260px,0.85fr)]">
          <Section
            id="waiting"
            title="Papás en la fila"
            cards={waiting}
            busyKey={busyKey}
            onTap={requestComplete}
            onInfo={(card) => setInfoTripId(card.trip.id)}
          />
          <NotifiedList cards={notified} onOpen={(card) => setNotifiedTripId(card.trip.id)} />
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

      {notifiedCard ? (
        <NotifiedSheet
          card={notifiedCard}
          busy={busyKey === notifiedCard.trip.id}
          onClose={() => setNotifiedTripId(null)}
          onFinish={() => closeFamily(notifiedCard.trip.id)}
          onUndo={async () => {
            await actFamily(notifiedCard.trip.id, "undo");
            setNotifiedTripId(null);
          }}
        />
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
  onInfo,
}: {
  id: Column;
  title: string;
  cards: FamilyCard[];
  busyKey: string | null;
  onTap: (card: FamilyCard) => void;
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
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {cards.length === 0 ? (
            <p className="col-span-full rounded-xl bg-paper/70 px-4 py-8 text-center text-sm text-muted">
              Nadie en la fila.
            </p>
          ) : (
            cards.map((card, index) => (
              <FamilyCardView
                key={card.trip.id}
                card={card}
                position={index + 1}
                busy={busyKey === card.trip.id}
                onTap={() => onTap(card)}
                onInfo={() => onInfo(card)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Familias ya entregadas, en lista compacta. Desaparecen al cerrarse el ciclo
 * (lector de salida, app, personal) o pasados unos minutos.
 */
function NotifiedList({ cards, onOpen }: { cards: FamilyCard[]; onOpen: (card: FamilyCard) => void }) {
  const tone = TONES.notified;
  const kidCount = cards.reduce((sum, card) => sum + card.kids.length, 0);

  return (
    <section className={`min-w-0 rounded-2xl border p-3 ${tone.panel}`}>
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          <h2 className="font-serif text-xl text-forest">Notificados</h2>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${tone.count}`}>
          {kidCount}
        </span>
      </header>

      {cards.length === 0 ? (
        <p className="rounded-xl bg-paper/70 px-4 py-8 text-center text-sm text-muted">
          Sin entregas en los últimos minutos.
        </p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.trip.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
              <div className="flex -space-x-2">
                {card.kids.slice(0, 3).map((kid) => (
                  <div key={kid.request.id} className="rounded-full ring-2 ring-paper">
                    <StudentAvatar student={kid.student} size="sm" />
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base leading-tight text-forest">
                  {card.kids.map((kid) => kid.student.firstName).join(" y ")}
                </p>
                <p className="truncate text-xs text-muted">
                  {card.trip.pickerName} · {formatTime(card.deliveredAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(card)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:text-forest"
                aria-label="Detalles y cerrar"
              >
                <Info className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
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
  position,
  busy,
  onTap,
  onInfo,
}: {
  card: FamilyCard;
  position: number;
  busy: boolean;
  onTap: () => void;
  onInfo: () => void;
}) {
  const siblings = card.kids.length > 1;
  const tone = TONES.waiting;
  const label = siblings ? `Entregar a los ${card.kids.length}` : "Entregar";
  const deniedKids = card.kids.filter((kid) => kid.request.authorization?.status === "denied");
  const pendingKids = card.kids.filter((kid) => kid.request.authorization?.status === "pending");

  const frame = card.denied
    ? "border-danger bg-danger/5 shadow-[inset_4px_0_0_0_var(--color-danger)]"
    : siblings
      ? "border-gold/60 shadow-[inset_4px_0_0_0_var(--color-gold)]"
      : "border-line";

  // Solo autos registrados (tag/familia). Visitas por QR sin vehículo no muestran modelo.
  const registeredCar =
    card.trip.method === "car" && card.vehicle
      ? [card.vehicle.label, card.vehicle.color].filter(Boolean).join(" · ")
      : null;

  return (
    <article className={`relative ${siblings ? "@md:col-span-2" : ""}`}>
      <button
        type="button"
        disabled={busy}
        onClick={onTap}
        className={`flex w-full flex-col rounded-xl border bg-paper p-4 pt-5 text-left transition active:scale-[0.98] disabled:opacity-60 ${frame}`}
      >
        {siblings ? (
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-gold-deep">
            <Users className="h-3.5 w-3.5" />
            Hermanos · mismo auto
          </p>
        ) : null}

        <div className={siblings ? "grid gap-4 @md:grid-cols-2" : ""}>
          {card.kids.map((kid) => (
            <div key={kid.request.id} className="flex items-center gap-3.5">
              <StudentAvatar student={kid.student} size="xl" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl leading-tight text-forest">{kid.student.firstName}</p>
                <p className="text-sm text-muted">{kid.student.lastName}</p>
                <p className="mt-0.5 text-xs text-muted">{studentGrade(kid.student, "es")}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted">
              {card.trip.pickerRelationEs} · {card.trip.pickerName}
            </p>
            {registeredCar ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-forest">
                <Car className="h-3.5 w-3.5 shrink-0 text-gold-deep" />
                <span>{registeredCar}</span>
              </p>
            ) : null}
          </div>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-deep text-xs font-bold text-paper">
            {position}
          </span>
        </div>

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
            card.denied ? "bg-danger text-paper" : tone.button
          }`}
        >
          {label}
        </span>
      </button>

      <div className="absolute right-2 top-2 flex gap-1.5">
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

function NotifiedSheet({
  card,
  busy,
  onClose,
  onFinish,
  onUndo,
}: {
  card: FamilyCard;
  busy: boolean;
  onClose: () => void;
  onFinish: () => void;
  onUndo: () => void;
}) {
  const staffName = card.kids[0]?.request.deliveredByStaffName;
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase text-forest">Entregado · {formatTime(card.deliveredAt)}</p>
          <h2 className="mt-1 font-serif text-2xl text-forest">
            {card.kids.map((kid) => kid.student.firstName).join(" y ")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {card.trip.pickerRelationEs} · {card.trip.pickerName} · {card.vehicleLabel}
            {card.vehicle?.plate ? ` · ${card.vehicle.plate}` : ""}
          </p>
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

      <div className="mt-4 space-y-2">
        {card.kids.map((kid) => (
          <div key={kid.request.id} className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
            <StudentAvatar student={kid.student} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{studentName(kid.student)}</p>
              <p className="text-xs text-muted">{studentGrade(kid.student, "es")}</p>
            </div>
            <p className="text-sm text-muted">{formatTime(kid.request.deliveredAt)}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        {staffName ? `Entregó ${staffName}. ` : ""}
        La familia sale de esta lista cuando el lector detecta su salida o a los{" "}
        {Math.round(DELIVERED_VISIBLE_MS / 60000)} minutos. Si ya se fueron, puedes cerrarlo aquí.
      </p>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onFinish}
          className="rounded-full bg-forest py-3.5 text-base font-semibold text-paper disabled:opacity-60"
        >
          Terminar · ya salieron
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onUndo}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold text-forest disabled:opacity-60"
        >
          <Undo2 className="h-4 w-4" />
          Regresar a la fila
        </button>
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
                className={`rounded-2xl border p-4 ${overdue ? "border-danger/40 bg-danger/5" : "border-gold/50 bg-gold/10"}`}
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
                          overdue ? "border-danger/40 bg-danger/10 text-danger" : "border-gold/50 bg-gold/15 text-gold-deep"
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
