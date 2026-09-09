"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { AlarmClock, CalendarDays, Car, CheckCircle2, ChevronRight, RadioTower, UserRound } from "lucide-react";
import { FullscreenQr } from "@/components/parent/fullscreen-qr";
import { ParentSchoolNews, SchoolContact } from "@/components/parent/parent-dashboard";
import { ShareRow } from "@/components/parent/parent-tracker";
import { StudentAvatar } from "@/components/ui/avatar";
import { pickupPayload } from "@/lib/qr";
import { findStudent, findVehicle, greeting, studentGrade } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, PickupTrip, Snapshot, Student } from "@/lib/types";

export function ParentPlanToday({
  snapshot,
  guardian,
  trip,
  locale,
  t,
  onChange,
  onLate,
  onFriends,
  onCancel,
  onAvisos,
  onCalendar,
  unreadCount,
  busy,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  trip: PickupTrip;
  locale: Locale;
  t: Dictionary;
  onChange: () => void;
  onLate: () => void;
  onFriends?: () => void;
  onCancel: () => void;
  onAvisos: () => void;
  onCalendar: () => void;
  unreadCount: number;
  busy: boolean;
}) {
  const requests = snapshot.requests.filter((request) => request.tripId === trip.id);
  const students = requests
    .map((request) => findStudent(snapshot, request.studentId))
    .filter((student): student is Student => Boolean(student));
  const vehicle = findVehicle(snapshot, trip.vehicleId);
  const useTag = trip.pickerKind === "self" && trip.method === "car" && Boolean(vehicle?.tagId);
  const showShare = trip.pickerKind === "guest" || trip.pickerKind === "authorized";
  const familyTime = earliestDismissal(students);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [qr, setQr] = useState("");
  const [expandedQr, setExpandedQr] = useState(false);

  useEffect(() => {
    if (useTag) return;
    QRCode.toDataURL(pickupPayload(trip.code, trip.qrToken), {
      margin: 1,
      width: 360,
      color: { dark: "#1B4D3E", light: "#FFFDF8" },
    }).then(setQr);
  }, [trip.code, trip.qrToken, useTag]);

  return (
    <div className="flex flex-col gap-5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{greeting(locale)},</p>
          <h1 className="font-serif text-4xl leading-none text-forest">{guardian.firstName}</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest">
          <CheckCircle2 className="h-4 w-4" />
          {t.planReady}
        </span>
      </div>

      <section className="overflow-hidden rounded-[1.75rem] bg-forest text-paper shadow-[0_18px_45px_rgb(18_56_45/0.18)]">
        <div className="relative px-5 pb-5 pt-5">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-gold/20 bg-gold/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-gold">
                <CalendarDays className="h-4 w-4" />
                {t.todayPlan}
              </p>
              <p className="mt-3 font-serif text-5xl leading-none tabular-nums">{familyTime}</p>
              <p className="mt-2 text-sm text-cream">{t.familyPickupTime}</p>
            </div>
            <div className="flex -space-x-3 pt-8">
              {students.map((student) => (
                <div key={student.id} className="rounded-full ring-2 ring-forest">
                  <StudentAvatar student={student} size="lg" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 space-y-2 border-t border-paper/15 pt-4">
            {students.map((student) => (
              <div key={student.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{student.firstName}</span>
                <span className="text-cream">
                  {studentGrade(student, locale)} · <span className="tabular-nums">{student.dismissalTime}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-4 shadow-[0_10px_30px_rgb(28_36_31/0.05)]">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-gold-deep">{t.pickupDetails}</p>
        <div className="mt-3 grid gap-3">
          <Detail icon={<UserRound className="h-4 w-4" />} label={t.whoPicks} value={`${locale === "es" ? trip.pickerRelationEs : trip.pickerRelationEn} · ${trip.pickerName}`} />
          <Detail icon={<Car className="h-4 w-4" />} label={t.howArrive} value={trip.method === "walk" ? t.walking : [vehicle?.label, vehicle?.plate].filter(Boolean).join(" · ")} />
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-4">
        {useTag && vehicle ? (
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep">
              <RadioTower className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-gold-deep">{t.tagReady}</p>
              <p className="mt-1 font-mono text-xl font-semibold tracking-wider text-forest">{vehicle.tagId}</p>
              <p className="mt-1 text-sm text-muted">{t.noActionNeeded}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpandedQr(true)}
            aria-label={t.expandQr}
            className="flex w-full items-center gap-4 text-left"
          >
            {qr ? <Image src={qr} alt={t.qrLabel} width={88} height={88} unoptimized className="h-[88px] w-[88px] rounded-xl" /> : <div className="h-[88px] w-[88px] rounded-xl bg-cream" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-gold-deep">{t.passReady}</p>
              <p className="mt-1 font-serif text-3xl tracking-[0.16em] text-forest">{trip.code.split("").join(" ")}</p>
              <p className="mt-1 text-sm text-muted">{t.codeHint}</p>
              <p className="mt-2 text-xs font-semibold text-forest">{t.tapToExpand}</p>
            </div>
          </button>
        )}
      </section>

      {expandedQr ? <FullscreenQr qr={qr} trip={trip} t={t} onClose={() => setExpandedQr(false)} /> : null}

      {showShare ? <ShareRow trip={trip} students={students} passUrl={typeof window === "undefined" ? "" : `${window.location.origin}/pase/${trip.qrToken}`} t={t} /> : null}

      <div className="grid gap-2">
        <button type="button" disabled={busy} onClick={onChange} className="flex min-h-12 items-center justify-between rounded-full bg-forest px-5 text-base font-semibold text-paper">
          {t.changeTodayPlan}
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" disabled={busy} onClick={onLate} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-gold/60 bg-gold/10 px-5 text-sm font-semibold text-gold-deep">
          <AlarmClock className="h-4 w-4" />
          {t.lateCta}
        </button>
        {confirmCancel ? (
          <section className="rounded-2xl border border-danger/30 bg-paper p-4" aria-label={t.cancelToday}>
            <p className="text-sm text-ink">{t.cancelTodayHint.replace("{names}", students.map((student) => student.firstName).join(", "))}</p>
            <button type="button" disabled={busy} onClick={onCancel} className="mt-3 min-h-11 w-full rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : t.cancelTodayConfirm}</button>
            <button type="button" disabled={busy} onClick={() => setConfirmCancel(false)} className="min-h-11 w-full text-sm font-semibold text-forest">{t.keepPlan}</button>
          </section>
        ) : <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className="min-h-11 text-sm font-semibold text-danger">{t.cancelToday}</button>}
        {onFriends ? (
          <button type="button" onClick={onFriends} className="min-h-11 text-sm font-semibold text-forest">
            {t.addFriendsPickup}
          </button>
        ) : null}
      </div>

      <ParentSchoolNews t={t} unreadCount={unreadCount} onAvisos={onAvisos} onCalendar={onCalendar} />
      <SchoolContact t={t} />
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-forest">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value || "—"}</p>
      </div>
    </div>
  );
}

function earliestDismissal(students: Student[]) {
  return [...students].sort((a, b) => dismissalMinutes(a.dismissalTime) - dismissalMinutes(b.dismissalTime))[0]?.dismissalTime ?? "—";
}

function dismissalMinutes(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*([ap])/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}
