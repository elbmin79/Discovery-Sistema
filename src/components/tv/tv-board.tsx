"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { BrandMark, BrandRow } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { SystemStatus, useSlowLoading } from "@/components/ui/system-status";
import { useSnapshot } from "@/hooks/use-snapshot";
import { DELIVERED_VISIBLE_MS as PICKUP_DELIVERED_VISIBLE_MS } from "@/lib/pickup-machine";
import { arrivalPicture, findStudent, findVehicle, formatTime, studentGrade } from "@/lib/school";
import type { PickupRequest, PickupTrip, Snapshot, Student, Vehicle } from "@/lib/types";
import { fallbackArrivalPhoto } from "@/lib/seed/demo-data";

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
  const { snapshot, error, retry } = useSnapshot();
  const [index, setIndex] = useState(0);
  const knownTrips = useRef<Set<string>>(new Set());
  const loadingSlow = useSlowLoading(!snapshot && !error);

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
  const rotationMs = Math.max(ROTATE_MS, Math.ceil((current?.kids.length ?? 1) / (current ? kidsPerPage(current) : 3)) * 3500);

  useEffect(() => {
    const ids = families.map((family) => family.trip.id);
    const fresh = ids.findIndex((id) => !knownTrips.current.has(id));
    knownTrips.current = new Set(ids);
    if (fresh >= 0 && knownTrips.current.size > 1) setIndex(fresh);
  }, [families]);

  useEffect(() => {
    if (total <= 1) return;
    const id = window.setTimeout(() => setIndex((value) => (value + 1) % total), rotationMs);
    return () => window.clearTimeout(id);
  }, [index, total, rotationMs]);

  const upNext = useMemo(() => {
    if (total <= 1) return [];
    const rotated = [...families.slice(safeIndex + 1), ...families.slice(0, safeIndex)];
    return rotated;
  }, [families, safeIndex, total]);

  if (error && !snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-forest-deep">
        <SystemStatus kind="error" context="pantalla" detail={error} onRetry={retry} className="text-paper [&_h2]:text-paper [&_p]:text-cream" />
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-forest-deep">
        <SystemStatus
          kind={loadingSlow ? "stuck" : "loading"}
          context="pantalla"
          onRetry={loadingSlow ? retry : undefined}
          className="text-paper [&_h2]:text-paper [&_p]:text-cream"
        />
      </main>
    );
  }

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
      style={{ "--tv-rotate": `${rotationMs}ms` } as React.CSSProperties}
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
              {upNext.slice(0, 3).map((family) => (
                <li key={family.trip.id} className="flex items-center gap-4 rounded-2xl bg-paper/8 px-4 py-3.5">
                  <div className="flex -space-x-3">
                    {family.kids.slice(0, 2).map((kid) => (
                      <div key={kid.request.id} className="rounded-full ring-[3px] ring-forest-deep">
                        <StudentAvatar student={kid.student} size="md" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-serif text-lg leading-tight xl:text-xl">
                      {[...new Set(family.kids.map((kid) => kid.student.lastName))].join(" / ")}<span className="mt-1 block font-sans text-sm text-paper/80">{family.kids.map((kid) => kid.student.firstName).join(", ")}</span>
                    </p>
                    <p className="mt-0.5 truncate text-base text-paper/60">
                      {family.trip.pickerName} · {formatTime(family.arrivedAt)}
                    </p>
                  </div>
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${STAGE_COPY[family.stage].dot}`} />
                </li>
              ))}
              {upNext.length > 3 ? (
                <li className="px-3 text-base text-paper/55">+{upNext.length - 3} familias más</li>
              ) : null}
              {total === 1 ? (
                <li className="px-3 text-base text-paper/55">Solo una familia en la fila.</li>
              ) : null}
            </ul>
          </aside>
        </div>

        <section className="rounded-[1.75rem] bg-forest/60 px-6 py-4 xl:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base tracking-[0.24em] uppercase text-gold xl:text-lg">Entregados</h2>
            <span className="text-base text-paper/55">
              {recent.length === 0 ? "" : `Última: ${formatTime(recent[0]?.request.deliveredAt)}`}
            </span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-lg text-paper/60">Aún no hay entregas confirmadas.</p>
          ) : (
            <ul className="mt-3 flex gap-6 overflow-hidden xl:gap-8">
              {recent.map((kid) => (
                <li key={kid.request.id} className="flex w-32 shrink-0 flex-col items-center text-center xl:w-40">
                  <div className="rounded-full ring-[3px] ring-forest/80">
                    <StudentAvatar student={kid.student} size="md" />
                  </div>
                  <p className="break-words mt-2 w-full font-serif text-lg leading-tight xl:text-xl">
                    {kid.student.lastName}
                  </p>
                  <p className="break-words text-sm">{kid.student.firstName}</p>
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

function kidsPerPage(family: TvFamily) {
  return new Set(family.kids.map((kid) => kid.student.lastName)).size === 1 ? 3 : 2;
}

function Spotlight({ family, position, total }: { family: TvFamily; position: number; total: number }) {
  const [broken, setBroken] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = kidsPerPage(family);
  const pages = Math.ceil(family.kids.length / perPage);
  useEffect(() => {
    if (pages < 2) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pages), 3500);
    return () => window.clearInterval(timer);
  }, [pages]);
  const kids = family.kids.slice((page % pages) * perPage, (page % pages) * perPage + perPage);
  const surnames = [...new Set(family.kids.map((kid) => kid.student.lastName))];
  const sharedName = surnames.length === 1 ? surnames[0] : null;
  const picture = arrivalPicture(family.trip, family.vehicle);
  const svg = fallbackArrivalPhoto(family.vehicle?.label ?? "Auto", family.vehicle?.color);
  const photo =
    broken >= 2
      ? svg
      : broken === 1
        ? picture.captured
          ? svg
          : picture.fallback ?? svg
        : picture.src ?? picture.fallback ?? svg;

  return (
    <section className="tv-in relative flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] bg-paper text-ink">
      <header className="shrink-0 border-b border-line px-5 py-4 xl:px-7">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest text-gold-deep">
          <span>Una recogida · {family.kids.length} {family.kids.length === 1 ? "alumno" : "alumnos"}</span>
          <span className="shrink-0 rounded-full bg-forest px-3 py-1 text-paper">{position} / {total}</span>
        </div>
        <h1 className="break-words font-serif text-[clamp(1.65rem,2.6vw,2.6rem)] leading-tight text-forest">{sharedName ?? "Familias que salen juntas"}</h1>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col justify-center gap-2 p-3 xl:gap-3 xl:p-5">
          {kids.map((kid) => (
            <div key={kid.request.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-cream/80 p-2 xl:p-3">
              <StudentAvatar student={kid.student} size="lg" />
              <div className="min-w-0 flex-1">
                {!sharedName ? <p className="break-words font-serif text-lg leading-tight text-forest">{kid.student.lastName}</p> : null}
                <p className="break-words font-serif text-[clamp(1.15rem,2vw,1.9rem)] leading-tight text-forest">{kid.student.firstName}</p>
                <p className="mt-1 text-xs leading-snug text-muted xl:text-sm">{studentGrade(kid.student, "es")}</p>
              </div>
            </div>
          ))}
          {pages > 1 ? <p className="text-center text-xs text-muted">Alumnos {page * perPage + 1}–{Math.min(page * perPage + perPage, family.kids.length)} de {family.kids.length}</p> : null}
        </div>
        <div className="flex min-h-0 flex-col border-l border-line bg-cream/60">
          <div className="relative min-h-0 flex-1">
            {photo ? <Image src={photo} alt={family.vehicle?.label ?? "Auto en la entrada"} fill unoptimized onError={() => setBroken((value) => Math.min(value + 1, 2))} className="object-contain p-3 xl:p-5" /> : null}
          </div>
          <div className="shrink-0 px-4 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold-deep">{picture.captured && broken === 0 ? "Foto de llegada" : "Auto en la fila"}</p>
            <p className="mt-1 break-words text-sm font-semibold text-forest xl:text-base">{family.vehicle?.label ?? "Auto"}</p>
            {family.vehicle?.plate ? <p className="mt-1 text-xs tabular-nums text-muted">{family.vehicle.plate}</p> : null}
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line bg-forest px-5 py-3 text-paper xl:px-7">
        <p className="min-w-0 break-words text-sm"><span className="text-gold">{family.trip.pickerRelationEs}</span> · {family.trip.pickerName}</p>
        <span className="shrink-0 text-sm tabular-nums text-cream">{formatTime(family.arrivedAt)}</span>
      </footer>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gold/20">{total > 1 ? <div className="tv-progress h-full bg-gold" /> : null}</div>
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
