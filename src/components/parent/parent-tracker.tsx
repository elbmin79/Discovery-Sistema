"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { RadioTower } from "lucide-react";
import { StudentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { postJson } from "@/hooks/use-snapshot";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { canCancel } from "@/lib/pickup-machine";
import { pickupPayload } from "@/lib/qr";
import { findStudent, findVehicle, findZone, studentGrade, studentName } from "@/lib/school";
import type {
  Locale,
  PickupStatus,
  PickupTrip,
  RequestAuthorization,
  Snapshot,
  Student,
  Vehicle,
} from "@/lib/types";

const STEPS: PickupStatus[] = ["on_the_way", "arrived", "delivered"];
/** Con tag la familia no "avisa llegada": el lector la pone en la fila, así que ese paso no se muestra. */
const TAG_STEPS: PickupStatus[] = ["arrived", "delivered"];

export function ParentTracker({
  snapshot,
  trip,
  locale,
  t,
  onCancel,
  onStartOver,
  busy,
}: {
  snapshot: Snapshot;
  trip: PickupTrip;
  locale: Locale;
  t: Dictionary;
  onCancel: () => void;
  onStartOver: () => void;
  busy: boolean;
}) {
  const requests = snapshot.requests.filter((request) => request.tripId === trip.id);
  const students = requests
    .map((request) => findStudent(snapshot, request.studentId))
    .filter((student): student is Student => Boolean(student));
  const vehicle = findVehicle(snapshot, trip.vehicleId);
  const allDelivered = requests.every((request) => request.status === "delivered");
  const canCancelTrip = requests.every((request) => canCancel(request.status));
  const passUrl =
    typeof window !== "undefined" ? `${window.location.origin}/pase/${trip.qrToken}` : "";
  const showShare = trip.pickerKind === "guest" || trip.pickerKind === "authorized";
  // Con tag en el auto no hace falta QR: el lector de la entrada reconoce a la familia.
  const useTag = trip.pickerKind === "self" && trip.method === "car" && Boolean(vehicle?.tagId);
  const names = joinKidNames(students.map((student) => student.firstName));

  if (allDelivered) {
    return (
      <DeliveredScreen
        trip={trip}
        names={names}
        plural={students.length > 1}
        useTag={useTag}
        locale={locale}
        t={t}
        onStartOver={onStartOver}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">{allDelivered ? t.deliveredTitle : t.trackerTitle}</p>
        <h1 className="font-serif text-3xl text-forest">
          {students.map((student) => student.firstName).join(" y ")}
        </h1>
      </div>

      {useTag && vehicle ? <TagPass vehicle={vehicle} arrived={Boolean(trip.arrivedAt)} t={t} /> : <ArrivalPass trip={trip} t={t} />}

      {showShare && !allDelivered ? (
        <ShareRow trip={trip} students={students} passUrl={passUrl} t={t} />
      ) : null}

      <div className="space-y-3">
        {requests.map((request) => {
          const student = findStudent(snapshot, request.studentId);
          if (!student) return null;
          const zone = findZone(snapshot, student.zoneId);
          return (
            <article key={request.id} className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex items-start gap-3">
                <StudentAvatar student={student} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{studentName(student)}</p>
                      <p className="text-sm text-muted">{studentGrade(student, locale)}</p>
                    </div>
                    <StatusBadge
                      status={request.status}
                      label={useTag && request.status === "on_the_way" ? t.tagLabel : t.status[request.status]}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {statusCopy(student, request.status, t, useTag)}
                  </p>
                  {request.authorization ? (
                    <AuthorizationLine snapshot={snapshot} authorization={request.authorization} t={t} />
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    {t.zone}: {locale === "es" ? zone?.shortEs : zone?.shortEn} · {t.dismissal}:{" "}
                    {student.dismissalTime}
                  </p>
                  <Progress status={request.status} steps={useTag ? TAG_STEPS : STEPS} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        {locale === "es" ? trip.pickerRelationEs : trip.pickerRelationEn} · {trip.pickerName}
        {vehicle ? ` · ${vehicle.label}` : ""}
        {trip.method === "walk" ? ` · ${t.walking}` : ""}
      </p>

      {canCancelTrip ? (
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm font-medium text-danger">
          {t.cancelPickup}
        </button>
      ) : null}
    </div>
  );
}

/** Con tag, el lector de salida "ve" el auto poco después de la entrega; se simula con este retraso. */
const SIMULATED_EXIT_MS = 6000;

function DeliveredScreen({
  trip,
  names,
  plural,
  useTag,
  locale,
  t,
  onStartOver,
}: {
  trip: PickupTrip;
  names: string;
  plural: boolean;
  useTag: boolean;
  locale: Locale;
  t: Dictionary;
  onStartOver: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const departed = Boolean(trip.departedAt);

  useEffect(() => {
    if (!useTag || departed) return;
    const timer = window.setTimeout(() => {
      postJson(`/api/trips/${trip.id}/depart`, { via: "tag" }).catch(() => undefined);
    }, SIMULATED_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [useTag, departed, trip.id]);

  async function confirmPickup() {
    setBusy(true);
    try {
      await postJson(`/api/trips/${trip.id}/depart`, { via: "parent" });
    } finally {
      setBusy(false);
    }
  }

  const noticeTitle = departed
    ? trip.departedVia === "tag"
      ? t.departDetectedTitle
      : t.departClosedTitle
    : t.departConfirmTitle;
  const noticeBody = departed
    ? trip.departedVia === "tag"
      ? t.departDetectedBody.replace("{kids}", names)
      : t.departClosedBody
    : t.departConfirmBody.replace("{kids}", names);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-forest px-8 text-center text-paper">
      <p className="text-xs tracking-[0.22em] uppercase text-gold">{t.deliveredTitle}</p>
      <h1 className="mt-5 font-serif text-4xl leading-tight">{names}</h1>
      <p className="mt-3 text-lg text-cream">
        {locale === "es" ? `${plural ? "Ya están" : "Ya está"} con ustedes.` : "They're with you now."}
      </p>
      <p className="mt-6 max-w-xs text-base leading-7 text-gold">{t.deliveredWish}</p>

      {useTag && !departed ? (
        <p className="mt-10 inline-flex items-center gap-2 text-sm text-cream/80">
          <span className="h-2 w-2 rounded-full bg-gold pulse-gold" />
          {t.departWaiting}
        </p>
      ) : null}

      {!useTag || departed ? (
        <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-paper px-6 pb-8 pt-6 text-left text-ink shadow-[0_-12px_40px_rgb(0_0_0/0.25)]">
          <p className="flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-gold-deep">
            {departed ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
            {noticeTitle}
          </p>
          <p className="mt-2 text-[15px] leading-6 text-ink">{noticeBody}</p>
          {departed ? (
            <button
              type="button"
              onClick={onStartOver}
              className="mt-5 w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper"
            >
              {t.ok}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={confirmPickup}
              className="mt-5 w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-60"
            >
              {t.departConfirmAction}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function joinKidNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return /^[hi]/i.test(names[1]) ? `${names[0]} e ${names[1]}` : `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function AuthorizationLine({
  snapshot,
  authorization,
  t,
}: {
  snapshot: Snapshot;
  authorization: RequestAuthorization;
  t: Dictionary;
}) {
  const owner = snapshot.guardians.find((item) => item.id === authorization.ownerGuardianId);
  const name = owner ? owner.firstName : "";
  const copy =
    authorization.status === "approved"
      ? t.authApprovedKid
      : authorization.status === "denied"
        ? t.authDeniedKid
        : t.authPendingKid;
  const tone =
    authorization.status === "approved"
      ? "bg-forest/10 text-forest"
      : authorization.status === "denied"
        ? "bg-danger/10 text-danger"
        : "bg-gold/20 text-gold-deep";
  return (
    <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {copy.replace("{name}", name)}
    </p>
  );
}

function TagPass({ vehicle, arrived, t }: { vehicle: Vehicle; arrived: boolean; t: Dictionary }) {
  return (
    <section className="rounded-3xl bg-forest px-5 py-5 text-paper">
      <p className="flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-gold">
        <RadioTower className="h-4 w-4" />
        {t.tagTitle}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-gold/50 bg-forest-deep">
          <span className="text-[10px] tracking-[0.2em] uppercase text-gold">{t.tagLabel}</span>
          <span className="mt-1 font-mono text-lg font-semibold tracking-wider">{vehicle.tagId}</span>
        </div>
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-tight">{vehicle.label}</p>
          {vehicle.plate ? <p className="mt-1 text-sm text-cream">{vehicle.plate}</p> : null}
          <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${arrived ? "text-gold" : "text-cream"}`}>
            <span className={`h-2 w-2 rounded-full ${arrived ? "bg-gold" : "bg-emerald-400 pulse-gold"}`} />
            {arrived ? t.status.arrived : t.status.on_the_way}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-cream">{t.tagHint}</p>
    </section>
  );
}

function ArrivalPass({ trip, t }: { trip: PickupTrip; t: Dictionary }) {
  const [qr, setQr] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(pickupPayload(trip.code, trip.qrToken), {
      margin: 1,
      width: 520,
      color: { dark: "#1B4D3E", light: "#FFFDF8" },
    }).then(setQr);
  }, [trip.code, trip.qrToken]);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-3xl bg-forest px-5 py-5 text-left text-paper"
      >
        <p className="text-xs tracking-[0.18em] uppercase text-gold">{t.codeTitle}</p>
        <div className="mt-4 flex items-center gap-4">
          {qr ? (
            <Image
              src={qr}
              alt={t.qrLabel}
              width={112}
              height={112}
              unoptimized
              className="h-28 w-28 rounded-2xl bg-paper p-2"
            />
          ) : (
            <div className="h-28 w-28 rounded-2xl bg-forest-deep" />
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-gold">{t.codeLabel}</p>
            <p className="mt-1 font-serif text-4xl tracking-[0.18em]">{trip.code.split("").join(" ")}</p>
            <p className="mt-2 text-xs text-cream">Toca para ampliar</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-cream">{t.codeHint}</p>
      </button>

      {expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-forest-deep px-6 text-paper"
        >
          <p className="text-xs tracking-[0.22em] uppercase text-gold">{t.qrLabel}</p>
          {qr ? (
            <Image
              src={qr}
              alt={t.qrLabel}
              width={320}
              height={320}
              unoptimized
              className="mt-4 h-72 w-72 rounded-3xl bg-paper p-4"
            />
          ) : null}
          <p className="mt-8 text-xs tracking-[0.22em] uppercase text-gold">{t.codeLabel}</p>
          <p className="mt-3 font-serif text-6xl tracking-[0.22em]">{trip.code.split("").join(" ")}</p>
          <p className="mt-8 text-sm text-cream">Toca para cerrar</p>
        </button>
      ) : null}
    </>
  );
}

function ShareRow({
  trip,
  students,
  passUrl,
  t,
}: {
  trip: PickupTrip;
  students: Student[];
  passUrl: string;
  t: Dictionary;
}) {
  const [copied, setCopied] = useState(false);
  const names = students.map((student) => student.firstName).join(" y ");
  const message = `Pase de salida Discovery para ${names}. Código ${trip.code}. ${passUrl}`;
  const phone = (trip.guestPhone ?? "").replace(/\D/g, "");

  return (
    <section>
      <p className="mb-2 text-sm font-semibold text-ink">{t.sharePass}</p>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`https://wa.me/${phone ? `52${phone}` : ""}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-paper py-3 text-center text-sm font-medium text-forest"
        >
          {t.shareWhatsApp}
        </a>
        <a
          href={`sms:${phone ? `+52${phone}` : ""}?body=${encodeURIComponent(message)}`}
          className="rounded-2xl bg-paper py-3 text-center text-sm font-medium text-forest"
        >
          {t.shareSms}
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(passUrl || message);
            setCopied(true);
          }}
          className="rounded-2xl bg-paper py-3 text-sm font-medium text-forest"
        >
          {copied ? t.copied : t.shareCopy}
        </button>
      </div>
    </section>
  );
}

function statusCopy(student: Student, status: PickupStatus, t: Dictionary, useTag: boolean) {
  if (status === "on_the_way") return useTag ? t.tagHint : t.onTheWayBody;
  if (status === "arrived") return t.arrivedBody;
  if (status === "delivered") {
    return `${student.firstName} ${student.gender === "f" ? t.deliveredBodyF : t.deliveredBody}`;
  }
  return t.status[status];
}

function Progress({ status, steps }: { status: PickupStatus; steps: PickupStatus[] }) {
  const index = steps.indexOf(status);
  return (
    <div className="mt-4 flex gap-1.5">
      {steps.map((step, stepIndex) => (
        <span
          key={step}
          className={`h-1.5 flex-1 rounded-full ${
            index >= stepIndex && status !== "cancelled" ? "bg-forest" : "bg-cream-deep"
          }`}
        />
      ))}
    </div>
  );
}
