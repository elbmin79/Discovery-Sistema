"use client";

import { useState } from "react";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson } from "@/hooks/use-snapshot";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { authorizationsFor, findStudent } from "@/lib/school";
import type { Guardian, Locale, PickupRequest, Snapshot } from "@/lib/types";

/**
 * Tarjetas "¿Está bien que X recoja a tu hijo?" para el tutor dueño del alumno.
 * Se agrupan por solicitud (viaje) para responder una sola vez por familia amiga.
 */
export function AuthorizationInbox({
  snapshot,
  guardian,
  locale,
  t,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  locale: Locale;
  t: Dictionary;
}) {
  const pending = authorizationsFor(snapshot, guardian.id);
  if (pending.length === 0) return null;

  const byTrip = new Map<string, PickupRequest[]>();
  for (const request of pending) {
    byTrip.set(request.tripId, [...(byTrip.get(request.tripId) ?? []), request]);
  }

  return (
    <div className="mb-4 space-y-3">
      {[...byTrip.entries()].map(([tripId, requests]) => (
        <AuthorizationCard
          key={tripId}
          snapshot={snapshot}
          guardian={guardian}
          requests={requests}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function AuthorizationCard({
  snapshot,
  guardian,
  requests,
  t,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  requests: PickupRequest[];
  locale: Locale;
  t: Dictionary;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const trip = snapshot.trips.find((item) => item.id === requests[0]?.tripId);
  const students = requests
    .map((request) => findStudent(snapshot, request.studentId))
    .filter((student): student is NonNullable<typeof student> => Boolean(student));
  if (!trip || students.length === 0) return null;

  const requester = snapshot.guardians.find((item) => item.id === trip.guardianId);
  const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : trip.pickerName;
  const status = requests.every((r) => r.authorization?.status === "approved")
    ? "approved"
    : requests.some((r) => r.authorization?.status === "denied")
      ? "denied"
      : "pending";
  const kids = students.map((student) => student.firstName).join(" y ");

  async function respond(decision: "approved" | "denied") {
    setBusy(true);
    try {
      for (const request of requests) {
        await postJson(`/api/requests/${request.id}/authorization`, { guardianId: guardian.id, decision });
      }
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const tone =
    status === "denied"
      ? "border-danger/50 bg-danger/5"
      : status === "approved"
        ? "border-forest/30 bg-forest/5"
        : "border-gold bg-gold/10";

  return (
    <section className={`rounded-3xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="flex -space-x-3">
          {students.slice(0, 3).map((student) => (
            <div key={student.id} className="rounded-full ring-2 ring-paper">
              <StudentAvatar student={student} size="md" />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-gold-deep">{t.friends}</p>
          <p className="mt-1 text-[15px] leading-6 text-ink">
            {t.authAsk.replace("{name}", requesterName).replace("{kids}", kids)}
          </p>
          {trip.pickerKind !== "self" ? (
            <p className="mt-1 text-xs text-muted">
              {trip.pickerRelationEs} · {trip.pickerName}
            </p>
          ) : null}
        </div>
      </div>

      {status === "pending" || editing ? (
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("approved")}
            className="rounded-full bg-forest py-3 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {t.authYes}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("denied")}
            className="rounded-full border border-danger/60 px-5 py-3 text-sm font-semibold text-danger disabled:opacity-60"
          >
            {t.authNo}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className={`text-sm ${status === "denied" ? "text-danger" : "text-forest"}`}>
            {status === "denied" ? t.authDeniedYou : t.authApprovedYou}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-sm font-semibold text-forest underline-offset-2 hover:underline"
          >
            {t.authChange}
          </button>
        </div>
      )}
    </section>
  );
}
