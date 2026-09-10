"use client";

import { useMemo, useState } from "react";
import { parentName } from "@/lib/parent-home";
import { lateEligibleStudentIds, lateReplacementTrips } from "@/lib/parent-home";
import { SchoolContact } from "@/components/parent/parent-dashboard";
import { Choice, Field } from "@/components/parent/picker-choice";
import { StudentAvatar } from "@/components/ui/avatar";
import { formatTime } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, LatePickup, Locale, PickerKind, PickupTrip, Snapshot } from "@/lib/types";

export interface LateCreatePayload {
  replaceTripIds: string[];
  replaceStudentIds: string[];
  studentIds: string[];
  pickerKind: PickerKind;
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  guestPhone?: string;
  etaAt: string;
  note?: string;
}

const ETA_PRESETS = [15, 30, 45, 60];

function timeToEta(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  if (date.getTime() < Date.now() - 60 * 60_000) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString();
}

export function ParentLate({
  snapshot,
  guardian,
  locale,
  t,
  busy,
  error,
  existing,
  initialTrip,
  jornada,
  onBack,
  onSubmit,
  onEtaUpdate,
  onCancelNotice,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  locale: Locale;
  t: Dictionary;
  busy: boolean;
  error: string | null;
  existing: LatePickup | null;
  initialTrip?: PickupTrip;
  jornada: string;
  onBack: () => void;
  onSubmit: (payload: LateCreatePayload) => void;
  onEtaUpdate: (etaAt: string) => void;
  onCancelNotice: () => void;
}) {
  const eligibleIds = lateEligibleStudentIds(snapshot, guardian, jornada);
  const children = snapshot.students.filter((student) => eligibleIds.includes(student.id));
  const [selectedIds, setSelectedIds] = useState<string[]>(existing?.studentIds ?? snapshot.requests.filter((request) => request.tripId === initialTrip?.id && eligibleIds.includes(request.studentId)).map((request) => request.studentId));
  const replacements = lateReplacementTrips(snapshot, guardian.id, selectedIds, jornada);
  const cancelledNames = snapshot.students.filter((student) => snapshot.requests.some((request) => request.studentId === student.id && replacements.some((trip) => trip.id === request.tripId))).map((student) => parentName(student)).join(", ");
  const [etaAt, setEtaAt] = useState<string | null>(existing?.etaAt ?? null);
  const [note, setNote] = useState(existing?.note ?? "");

  const authorized = snapshot.authorizedPeople.filter((person) =>
    person.studentIds.some((id) => (selectedIds.length > 0 ? selectedIds.includes(id) : guardian.studentIds.includes(id))),
  );
  const initialAuthorized = authorized.find((person) => [`${person.lastName} ${person.firstName}`, `${person.firstName} ${person.lastName}`].includes(initialTrip?.pickerName ?? ""));
  const initialGuest = initialTrip && initialTrip.pickerKind !== "self" && !initialAuthorized;
  const [pickerId, setPickerId] = useState(initialAuthorized ? `auth:${initialAuthorized.id}` : initialGuest ? "guest" : `self:${guardian.id}`);
  const [guestName, setGuestName] = useState(initialGuest ? initialTrip.pickerName : "");
  const [guestRelation, setGuestRelation] = useState(initialGuest ? (locale === "es" ? initialTrip.pickerRelationEs : initialTrip.pickerRelationEn) : "");
  const [guestPhone, setGuestPhone] = useState(initialTrip?.guestPhone ?? "");

  const picker = useMemo(() => {
    if (pickerId === "guest") {
      return {
        pickerKind: "guest" as PickerKind,
        pickerName: guestName.trim(),
        pickerRelationEs: guestRelation.trim() || "Visita",
        pickerRelationEn: guestRelation.trim() || "Guest",
        guestPhone: guestPhone.trim() || undefined,
      };
    }
    const person = authorized.find((item) => `auth:${item.id}` === pickerId);
    if (person) {
      return {
        pickerKind: "authorized" as PickerKind,
        pickerName: `${person.lastName} ${person.firstName}`,
        pickerRelationEs: person.relationEs,
        pickerRelationEn: person.relationEn,
        guestPhone: undefined,
      };
    }
    return {
      pickerKind: "self" as PickerKind,
      pickerName: `${guardian.lastName} ${guardian.firstName}`,
      pickerRelationEs: guardian.relationEs,
      pickerRelationEn: guardian.relationEn,
      guestPhone: undefined,
    };
  }, [authorized, guardian, guestName, guestPhone, guestRelation, pickerId]);

  const guestValid =
    picker.pickerKind !== "guest" || (guestName.trim().length > 1 && guestRelation.trim().length > 0);
  const canSubmit = selectedIds.length > 0 && etaAt !== null && guestValid;

  if (existing) {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" disabled={busy} onClick={onBack} className="self-start text-sm font-medium text-forest">
          ← {t.back}
        </button>
        <div>
          <p className="text-sm text-muted">{t.lateUpdateTitle}</p>
          <h1 className="font-serif text-3xl text-forest">{t.lateTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.lateCurrentEta.replace("{time}", formatTime(existing.etaAt, locale))}
          </p>
          <p className="mt-1 text-sm text-muted">
            {snapshot.students
              .filter((student) => existing.studentIds.includes(student.id))
              .map((student) => parentName(student))
              .join(" y ")}
          </p>
        </div>

        <EtaPicker t={t} locale={locale} etaAt={etaAt} onChange={setEtaAt} />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="button"
          disabled={busy || !etaAt}
          onClick={() => etaAt && onEtaUpdate(etaAt)}
          className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-50"
        >
          {busy ? "…" : t.lateUpdate}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancelNotice}
          className="w-full rounded-full border border-danger/40 py-3 text-sm font-semibold text-danger"
        >
          {t.lateCancelNotice}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" disabled={busy} onClick={onBack} className="self-start text-sm font-medium text-forest">
        ← {t.back}
      </button>
      <div>
        <p className="text-sm text-muted">{t.lateIntro}</p>
        <h1 className="font-serif text-3xl text-forest">{t.lateTitle}</h1>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">{t.children}</h2>
        <div className="mt-3 space-y-2">
          {children.map((child) => {
            const active = selectedIds.includes(child.id);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() =>
                  setSelectedIds((current) =>
                    current.includes(child.id)
                      ? current.filter((id) => id !== child.id)
                      : [...current, child.id],
                  )
                }
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                  active ? "border-forest bg-paper" : "border-line bg-paper/70"
                }`}
              >
                <StudentAvatar student={child} size="sm" />
                <p className="min-w-0 flex-1 truncate font-medium text-ink">{parentName(child)}</p>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    active ? "border-forest bg-forest text-paper" : "border-line"
                  }`}
                >
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t.whoPicks}</h2>
          <div className="mt-3 space-y-2">
            <Choice
              active={pickerId === `self:${guardian.id}`}
              title={`${t.me} · ${guardian.firstName}`}
              detail={locale === "es" ? guardian.relationEs : guardian.relationEn}
              onClick={() => setPickerId(`self:${guardian.id}`)}
            />
            {authorized.map((person) => (
              <Choice
                key={person.id}
                active={pickerId === `auth:${person.id}`}
                title={`${person.firstName} ${person.lastName}`}
                detail={`${t.authorized} · ${locale === "es" ? person.relationEs : person.relationEn}`}
                onClick={() => setPickerId(`auth:${person.id}`)}
              />
            ))}
            <Choice
              active={pickerId === "guest"}
              title={t.guest}
              detail={t.guestHint}
              onClick={() => setPickerId("guest")}
            />
          </div>
        </div>

        {pickerId === "guest" ? (
          <div className="space-y-2 rounded-3xl bg-paper p-4">
            <Field label={t.guestName} value={guestName} onChange={setGuestName} />
            <Field label={t.guestRelation} value={guestRelation} onChange={setGuestRelation} placeholder="Tía, vecina…" />
            <Field label={t.guestPhone} value={guestPhone} onChange={setGuestPhone} placeholder="686 123 4567" />
          </div>
        ) : null}
      </section>

      <EtaPicker t={t} locale={locale} etaAt={etaAt} onChange={setEtaAt} />

      <label className="block text-sm font-medium text-ink">
        {t.lateNote}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.lateNotePlaceholder}
          rows={2}
          className="mt-1 w-full rounded-2xl border border-line px-3 py-2 font-normal"
        />
      </label>

      {replacements.length ? <p role="note" className="rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm text-ink">{t.lateReplacement.replace("{names}", cancelledNames)}</p> : null}
      {error ? <div role="alert" className="space-y-3"><p className="text-sm text-danger">{error}</p><SchoolContact t={t} /></div> : null}

      <button
        type="button"
        disabled={busy || !canSubmit}
        onClick={() => {
          if (!etaAt) return;
          onSubmit({
            replaceTripIds: replacements.map((trip) => trip.id),
            replaceStudentIds: snapshot.requests.filter((request) => replacements.some((trip) => trip.id === request.tripId)).map((request) => request.studentId),
            studentIds: selectedIds,
            pickerKind: picker.pickerKind,
            pickerName: picker.pickerName,
            pickerRelationEs: picker.pickerRelationEs,
            pickerRelationEn: picker.pickerRelationEn,
            guestPhone: picker.guestPhone,
            etaAt,
            note: note.trim() || undefined,
          });
        }}
        className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-50"
      >
        {busy ? "…" : t.lateSend}
      </button>
    </div>
  );
}

function EtaPicker({
  t,
  locale,
  etaAt,
  onChange,
}: {
  t: Dictionary;
  locale: Locale;
  etaAt: string | null;
  onChange: (etaAt: string | null) => void;
}) {
  const [timeValue, setTimeValue] = useState(() =>
    etaAt
      ? new Date(etaAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "",
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  function pickIso(iso: string) {
    setTimeValue(new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }));
    onChange(iso);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">{t.lateWhen}</h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {ETA_PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => {
              setSelectedPreset(minutes);
              pickIso(new Date(Date.now() + minutes * 60_000).toISOString());
            }}
            className={`rounded-2xl border py-3 text-sm font-semibold ${
              selectedPreset === minutes
                ? "border-forest bg-forest text-paper"
                : "border-line bg-paper text-ink"
            }`}
          >
            +{minutes >= 60 ? "1h" : minutes}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
        <label className="text-sm font-medium text-ink">{t.lateAtTime}</label>
        <input
          type="time"
          value={timeValue}
          onChange={(event) => {
            setSelectedPreset(null);
            setTimeValue(event.target.value);
            onChange(event.target.value ? timeToEta(event.target.value) : null);
          }}
          className="ml-auto rounded-xl border border-line px-3 py-2 text-sm"
        />
      </div>
      {etaAt ? (
        <p className="mt-2 text-sm font-semibold text-gold-deep">≈ {formatTime(etaAt, locale)}</p>
      ) : null}
    </section>
  );
}
