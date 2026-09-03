"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { BrandMark, BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { useSnapshot } from "@/hooks/use-snapshot";
import { DELIVERED_VISIBLE_MS as PICKUP_DELIVERED_VISIBLE_MS } from "@/lib/pickup-machine";
import { arrivalPicture, findStudent, findVehicle, formatTime, studentGrade } from "@/lib/school";
import type { PickupRequest, PickupTrip, Snapshot, Student, Vehicle } from "@/lib/types";

const ROTATE_MS = 7000;
const RECENT_LIMIT = 8;
const DELIVERED_VISIBLE_MS = PICKUP_DELIVERED_VISIBLE_MS;

type Stage = "waiting";

interface Kid {
  request: PickupRequest;
  student: Student;
}

interface TvFamily {
  trip: PickupTrip;
  kids: Kid[];
  vehicle?: Vehicle;
  arrivedAt: string;
  stage: Stage;
}

const STAGE_COPY: Record<Stage, { label: string; hint: string; pill: string; dot: string }> = {
  waiting: {
    label: "Papás en la fila",
    hint: "El personal los entrega enseguida",
    pill: "bg-gold text-forest-deep",
    dot: "bg-gold",
  },
};

function buildFamilies(snapshot: Snapshot): TvFamily[] {
  const byTrip = new Map<string, TvFamily>();

  for (const request of snapshot.requests) {
    if (request.status !== "arrived") continue;
    // Una recogida que la familia del alumno rechazó no se anuncia en pantalla hasta resolverse.
    if (request.authorization?.status === "denied") continue;
    const student = findStudent(snapshot, request.studentId);
    const trip = snapshot.trips.find((item) => item.id === request.tripId);
    if (!student || !trip) continue;

    let family = byTrip.get(trip.id);
    if (!family) {
      family = {
        trip,
        kids: [],
        vehicle: findVehicle(snapshot, trip.vehicleId),
        arrivedAt: request.arrivedAt ?? trip.arrivedAt ?? request.requestedAt,
        stage: "waiting",
      };
      byTrip.set(trip.id, family);
    }
    family.kids.push({ request, student });
  }

  return [...byTrip.values()].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
}

function buildRecent(snapshot: Snapshot, nowMs: number): Kid[] {
  return snapshot.requests
    .filter((request) => {
      if (request.status !== "delivered" || !request.deliveredAt) return false;
      const trip = snapshot.trips.find((item) => item.id === request.tripId);
      // Igual que en el tablero: el alumno sale de pantalla al cerrarse el ciclo o pasados unos minutos.
      if (trip?.departedAt) return false;
      return nowMs - Date.parse(request.deliveredAt) < DELIVERED_VISIBLE_MS;
    })
    .map((request) => {
      const student = findStudent(snapshot, request.studentId);
      return student ? { request, student } : null;
    })
    .filter((kid): kid is Kid => Boolean(kid))
    .sort((a, b) => (b.request.deliveredAt ?? "").localeCompare(a.request.deliveredAt ?? ""))
    .slice(0, RECENT_LIMIT);
}

export function TvBoard() {
  const { snapshot } = useSnapshot();
  const [index, setIndex] = useState(0);
  const knownTrips = useRef<Set<string>>(new Set());

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const families = useMemo(() => (snapshot ? buildFamilies(snapshot) : []), [snapshot]);
  const recent = useMemo(() => (snapshot ? buildRecent(snapshot, nowMs) : []), [snapshot, nowMs]);

  const total = families.length;
  const safeIndex = total ? index % total : 0;
  const current = total ? families[safeIndex] : undefined;

  // Al llegar una familia nueva, la pantalla salta a ella de inmediato.
  useEffect(() => {
    const ids = families.map((family) => family.trip.id);
    const fresh = ids.findIndex((id) => !knownTrips.current.has(id));
    knownTrips.current = new Set(ids);
    if (fresh >= 0 && knownTrips.current.size > 1) setIndex(fresh);
  }, [families]);

  useEffect(() => {
    if (total <= 1) return;
    const id = window.setTimeout(() => setIndex((value) => (value + 1) % total), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [index, total]);

  const upNext = useMemo(() => {
    if (total <= 1) return [];
    const rotated = [...families.slice(safeIndex + 1), ...families.slice(0, safeIndex)];
    return rotated;
  }, [families, safeIndex, total]);

  function goFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }

  return (
    <div
      className="group/tv flex h-dvh flex-col overflow-hidden bg-forest-deep text-paper"
      style={{ "--tv-rotate": `${ROTATE_MS}ms` } as React.CSSProperties}
    >
      <header className="flex items-center justify-between px-8 pt-6 pb-4 xl:px-12">
        <Link href="/" className="rounded-lg">
          <BrandRow light />
        </Link>
        <p className="hidden text-sm tracking-[0.3em] uppercase text-gold md:block">Salida escolar · hoy</p>
        <div className="flex items-center gap-4">
          <Clock />
          <button
            type="button"
            onClick={goFullscreen}
            className="rounded-full border border-paper/20 p-2 text-paper/60 opacity-0 transition group-hover/tv:opacity-100 hover:text-paper"
            aria-label="Pantalla completa"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-5 px-8 pb-6 xl:px-12">
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1.15fr)]">
          {current ? (
            <Spotlight key={current.trip.id + safeIndex} family={current} position={safeIndex + 1} total={total} />
          ) : (
            <Idle />
          )}

          <aside className="hidden min-h-0 flex-col rounded-[1.75rem] bg-forest/60 p-6 xl:p-8 lg:flex">
            <h2 className="text-base tracking-[0.24em] uppercase text-gold xl:text-lg">Siguientes</h2>
            <p className="mt-1 text-base text-paper/70 xl:text-lg">
              {total === 0
                ? "Nadie en la fila."
                : `${total} ${total === 1 ? "familia" : "familias"} · ${families.reduce(
                    (sum, family) => sum + family.kids.length,
                    0,
                  )} alumnos`}
            </p>
            <ul className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              {upNext.slice(0, 5).map((family) => (
                <li key={family.trip.id} className="flex items-center gap-4 rounded-2xl bg-paper/8 px-4 py-3.5">
                  <div className="flex -space-x-4">
                    {family.kids.slice(0, 3).map((kid) => (
                      <div key={kid.request.id} className="rounded-full ring-[3px] ring-forest-deep">
                        <StudentAvatar student={kid.student} size="lg" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-2xl leading-tight xl:text-3xl">
                      {family.kids.map((kid) => kid.student.firstName).join(" y ")}
                    </p>
                    <p className="mt-0.5 truncate text-base text-paper/60">
                      {family.trip.pickerName} · {formatTime(family.arrivedAt)}
                    </p>
                  </div>
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${STAGE_COPY[family.stage].dot}`} />
                </li>
              ))}
              {upNext.length > 5 ? (
                <li className="px-3 text-base text-paper/55">+{upNext.length - 5} familias más</li>
              ) : null}
              {total === 1 ? (
                <li className="px-3 text-base text-paper/55">Solo una familia en la fila.</li>
              ) : null}
            </ul>
          </aside>
        </div>

        <section className="rounded-[1.75rem] bg-forest/60 px-6 py-5 xl:px-8 xl:py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base tracking-[0.24em] uppercase text-gold xl:text-lg">Entregados</h2>
            <span className="text-base text-paper/55">
              {recent.length === 0 ? "" : `Última: ${formatTime(recent[0]?.request.deliveredAt)}`}
            </span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-lg text-paper/60">Aún no hay entregas confirmadas.</p>
          ) : (
            <ul className="mt-4 flex gap-6 overflow-hidden xl:gap-8">
              {recent.map((kid) => (
                <li key={kid.request.id} className="flex w-32 shrink-0 flex-col items-center text-center xl:w-40">
                  <div className="rounded-full ring-[3px] ring-emerald-400/80">
                    <StudentAvatar student={kid.student} size="xl" />
                  </div>
                  <p className="mt-3 w-full truncate font-serif text-xl leading-tight xl:text-2xl">
                    {kid.student.firstName}
                  </p>
                  <p className="text-sm text-paper/55 xl:text-base">{formatTime(kid.request.deliveredAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Spotlight({ family, position, total }: { family: TvFamily; position: number; total: number }) {
  const copy = STAGE_COPY[family.stage];
  const picture = arrivalPicture(family.trip, family.vehicle);
  const photo = picture.src ?? picture.fallback;
  const siblings = family.kids.length > 1;

  return (
    <section className="tv-in relative flex min-h-0 overflow-hidden rounded-[1.75rem] bg-paper text-ink">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-6 p-8 xl:gap-8 xl:p-12">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide ${copy.pill}`}>
            {copy.label}
          </span>
          <span className="text-sm text-muted">{copy.hint}</span>
        </div>

        <div className={`flex flex-wrap gap-6 ${siblings ? "xl:gap-10" : ""}`}>
          {family.kids.map((kid) => (
            <div key={kid.request.id} className="flex items-center gap-5">
              <StudentAvatar student={kid.student} size={siblings ? "2xl" : "3xl"} />
              <div className="min-w-0">
                <p
                  className={`font-serif leading-none text-forest ${
                    siblings ? "text-[clamp(2rem,3.4vw,3.75rem)]" : "text-[clamp(2.5rem,4.6vw,5.5rem)]"
                  }`}
                >
                  {kid.student.firstName}
                </p>
                <p className="mt-2 text-[clamp(1rem,1.5vw,1.5rem)] text-muted">
                  {kid.student.lastName} · {studentGrade(kid.student, "es")}
                </p>
              </div>
            </div>
          ))}
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-[clamp(1rem,1.4vw,1.35rem)]">
          <div>
            <dt className="text-xs tracking-[0.2em] uppercase text-gold-deep">Viene por {siblings ? "ellos" : "él/ella"}</dt>
            <dd className="mt-1 text-forest">
              {family.trip.pickerName}
              <span className="text-muted"> · {family.trip.pickerRelationEs}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.2em] uppercase text-gold-deep">Llegó</dt>
            <dd className="mt-1 text-forest">{formatTime(family.arrivedAt)}</dd>
          </div>
          {family.vehicle ? (
            <div>
              <dt className="text-xs tracking-[0.2em] uppercase text-gold-deep">Auto</dt>
              <dd className="mt-1 text-forest">
                {family.vehicle.label}
                {family.vehicle.plate ? <span className="text-muted"> · {family.vehicle.plate}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="relative hidden min-h-0 w-[42%] shrink-0 bg-ink/5 md:block">
        {photo ? (
          <Image
            src={photo}
            alt={family.vehicle?.label ?? "Auto en la entrada"}
            fill
            unoptimized
            className="object-contain object-center p-3"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">Sin foto del auto</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-forest-deep/75 via-forest-deep/35 to-transparent px-5 pb-5 pt-16">
          <p className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-gold">
            {picture.captured ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Foto de llegada · {formatTime(family.arrivedAt)}
              </>
            ) : (
              "En la puerta"
            )}
          </p>
          <p className="font-serif text-2xl text-paper xl:text-3xl">
            {family.vehicle?.label ?? "Llegó a pie"}
          </p>
        </div>
      </div>

      {total > 1 ? (
        <span className="absolute right-5 top-5 rounded-full bg-forest-deep/80 px-3 py-1 text-sm font-semibold tabular-nums text-paper md:right-auto md:left-5 md:top-auto md:bottom-5">
          {position} / {total}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-line">
        {total > 1 ? <div className="tv-progress h-full bg-gold" /> : <div className="h-full w-full bg-gold/40" />}
      </div>
    </section>
  );
}

function Idle() {
  return (
    <section className="flex flex-col items-center justify-center rounded-[1.75rem] border border-paper/10 bg-forest/40 p-10 text-center">
      <BrandMark light size={96} />
      <p className="mt-8 font-serif text-4xl">Todo tranquilo por ahora</p>
      <p className="mt-3 max-w-md text-lg text-paper/60">
        Cuando una familia llegue a la puerta, aparecerá aquí con la foto de su auto.
      </p>
    </section>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  return (
    <div className="text-right">
      <p className="font-serif text-3xl leading-none tabular-nums xl:text-4xl">
        {now ? now.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" }) : "--:--"}
      </p>
      <p className="mt-1 text-xs capitalize text-paper/55">
        {now ? now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : ""}
      </p>
    </div>
  );
}
