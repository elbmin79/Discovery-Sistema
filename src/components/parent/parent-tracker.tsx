"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { StudentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { canCancel } from "@/lib/pickup-machine";
import { pickupPayload } from "@/lib/qr";
import { findStudent, findVehicle, findZone, studentGrade, studentName } from "@/lib/school";
import type { Locale, PickupStatus, PickupTrip, Snapshot, Student } from "@/lib/types";

const STEPS: PickupStatus[] = ["on_the_way", "arrived", "preparing", "ready", "delivered"];

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">{allDelivered ? t.deliveredTitle : t.trackerTitle}</p>
        <h1 className="font-serif text-3xl text-forest">
          {students.map((student) => student.firstName).join(" y ")}
        </h1>
      </div>

      <ArrivalPass trip={trip} t={t} />

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
                    <StatusBadge status={request.status} label={t.status[request.status]} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {statusCopy(student, request.status, t)}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {t.zone}: {locale === "es" ? zone?.shortEs : zone?.shortEn} · {t.dismissal}:{" "}
                    {student.dismissalTime}
                  </p>
                  <Progress status={request.status} />
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

      {allDelivered ? (
        <button
          type="button"
          onClick={onStartOver}
          className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper"
        >
          {t.startOver}
        </button>
      ) : null}

      {canCancelTrip ? (
        <button type="button" disabled={busy} onClick={onCancel} className="text-sm font-medium text-danger">
          {t.cancelPickup}
        </button>
      ) : null}
    </div>
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

function statusCopy(student: Student, status: PickupStatus, t: Dictionary) {
  if (status === "on_the_way") return t.onTheWayBody;
  if (status === "arrived") return t.arrivedBody;
  if (status === "preparing") {
    return `${student.firstName} ${student.gender === "f" ? t.preparingBody : t.preparingBodyM}`;
  }
  if (status === "ready") {
    return `${student.firstName} ${student.gender === "f" ? t.readyBody : t.readyBodyM}`;
  }
  if (status === "delivered") {
    return `${student.firstName} ${student.gender === "f" ? t.deliveredBodyF : t.deliveredBody}`;
  }
  return t.status[status];
}

function Progress({ status }: { status: PickupStatus }) {
  const index = STEPS.indexOf(status);
  return (
    <div className="mt-4 flex gap-1.5">
      {STEPS.map((step, stepIndex) => (
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
