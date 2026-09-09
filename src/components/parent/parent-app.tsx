"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlarmClock, Globe, House, Megaphone, UserRound } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { PhoneShell } from "@/components/parent/phone-shell";
import { type LateCreatePayload, ParentLate } from "@/components/parent/parent-late";
import { ParentDashboard } from "@/components/parent/parent-dashboard";
import { ParentHome } from "@/components/parent/parent-home";
import { ParentLogin } from "@/components/parent/parent-login";
import { ParentAnnouncements } from "@/components/parent/parent-announcements";
import { ParentCalendar } from "@/components/parent/parent-calendar";
import { ParentPlanToday } from "@/components/parent/parent-plan-today";
import { ParentSettings } from "@/components/parent/parent-settings";
import { ParentSetup } from "@/components/parent/parent-setup";
import { ParentTracker } from "@/components/parent/parent-tracker";
import { AuthorizationInbox } from "@/components/parent/authorization-inbox";
import { RemoveFromPickupSheet } from "@/components/parent/remove-from-pickup-sheet";
import { SystemStatus, useSlowLoading } from "@/components/ui/system-status";
import { useLocale } from "@/hooks/use-locale";
import { useSession } from "@/hooks/use-session";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { canRemoveFromTrip } from "@/lib/pickup-machine";
import { unreadAnnouncements } from "@/lib/school-comms";
import { formatTime, friendKids, jornadaOf, todayJornada } from "@/lib/school";
import type { CreateTripInput, Snapshot } from "@/lib/types";

function activeTripForGuardian(snapshot: Snapshot, guardianId: string, jornada: string) {
  return snapshot.trips.find((trip) => {
    if (trip.guardianId !== guardianId || trip.cancelledAt || jornadaOf(trip.createdAt) !== jornada) return false;
    return snapshot.requests.some(
      (request) =>
        request.tripId === trip.id &&
        request.status !== "cancelled" &&
        request.status !== "delivered",
    );
  });
}

const CLOSED_TRIP_VISIBLE_MS = 10 * 60 * 1000;

function completedTripForGuardian(snapshot: Snapshot, guardianId: string, jornada: string) {
  return snapshot.trips.find((trip) => {
    if (trip.guardianId !== guardianId || trip.cancelledAt || jornadaOf(trip.createdAt) !== jornada) return false;
    // Un viaje ya cerrado hace rato no debe volver a saludar al abrir la app.
    if (trip.departedAt && Date.now() - Date.parse(trip.departedAt) > CLOSED_TRIP_VISIBLE_MS) return false;
    const requests = snapshot.requests.filter((request) => request.tripId === trip.id);
    return requests.length > 0 && requests.every((request) => request.status === "delivered");
  });
}

export function ParentApp() {
  const { snapshot, error: syncError, retry } = useSnapshot();
  const contentRef = useRef<HTMLDivElement>(null);
  const { locale, t, toggle } = useLocale();
  const { session, setSession, clearSession } = useSession("parent");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const jornada = todayJornada(now);
  const [notice, setNotice] = useState<"planCancelled" | "lateSent" | "lateSentReplaced" | "lateUpdated" | "lateCancelled" | null>(null);
  const [tab, setTab] = useState<"home" | "settings">("home");
  const [step, setStep] = useState<"home" | "select" | "setup" | "late" | "avisos" | "calendario">("home");
  const [lateMode, setLateMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedTripId, setDismissedTripId] = useState<string | null>(null);
  const [removingKids, setRemovingKids] = useState(false);
  const [openAnnouncementId, setOpenAnnouncementId] = useState<string | null>(null);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>([]);
  const loadingSlow = useSlowLoading(Boolean(session && !snapshot && !syncError));

  const guardian = snapshot?.guardians.find((item) => item.id === session?.guardianId);
  const children = useMemo(
    () => snapshot?.students.filter((student) => guardian?.studentIds.includes(student.id)) ?? [],
    [snapshot, guardian],
  );
  const friendsChildren = useMemo(
    () => (snapshot && guardian ? friendKids(snapshot, guardian) : []),
    [snapshot, guardian],
  );
  const activeTrip = snapshot && guardian ? activeTripForGuardian(snapshot, guardian.id, jornada) : undefined;
  const doneTrip = snapshot && guardian ? completedTripForGuardian(snapshot, guardian.id, jornada) : undefined;
  const trip = activeTrip ?? (doneTrip && doneTrip.id !== dismissedTripId ? doneTrip : undefined);
  const activeLate =
    (snapshot && guardian
      ? (snapshot.latePickups ?? []).find(
          (late) => late.guardianId === guardian.id && late.status === "announced" && jornadaOf(late.createdAt) === jornada,
        )
      : null) ?? null;
  const tripRequests = snapshot && trip ? snapshot.requests.filter((request) => request.tripId === trip.id) : [];
  const activeTripRequests = tripRequests.filter((request) => request.status !== "cancelled");
  const removableRequests = activeTripRequests.filter((request) => canRemoveFromTrip(request.status));
  const tripArrived = Boolean(trip?.arrivedAt || activeTripRequests.some((request) => request.status !== "on_the_way"));
  const showNav = Boolean(session && guardian && (step === "home" || step === "avisos" || step === "calendario") && !tripArrived);
  const unread = snapshot && guardian ? unreadAnnouncements(snapshot, guardian) : [];
  const toastNotice = unread.find((item) => !dismissedNoticeIds.includes(item.id)) ?? null;

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [step, tab, trip?.id, openAnnouncementId]);

  async function openAnnouncement(id: string) {
    setOpenAnnouncementId(id);
    setStep("avisos");
    setDismissedNoticeIds((current) => (current.includes(id) ? current : [...current, id]));
    try {
      await postJson(`/api/school/announcements/${id}`, { action: "read" });
    } catch {
      /* el aviso sigue abierto; el badge se sincroniza en el próximo poll */
    }
  }

  async function saveTrip(input: Omit<CreateTripInput, "guardianId" | "studentIds">) {
    if (!guardian) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const payload = { ...input, guardianId: guardian.id, studentIds: selected };
      await postJson(trip && !tripArrived ? `/api/trips/${trip.id}` : "/api/trips", payload);
      setStep("home");
      setTab("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  async function cancelTrip(tripId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await postJson(`/api/trips/${tripId}/cancel`);
      setSelected([]);
      setStep("home");
      setNotice("planCancelled");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  async function submitLate(payload: LateCreatePayload) {
    if (!guardian) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await postJson("/api/late", { ...payload, guardianId: guardian.id });
      setSelected([]);
      setNotice(payload.replaceTripIds?.length ? "lateSentReplaced" : "lateSent");
      setStep("home");
      setTab("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  async function updateLateEta(etaAt: string) {
    if (!activeLate) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await postJson(`/api/late/${activeLate.id}`, { action: "eta", etaAt });
      setNotice("lateUpdated");
      setStep("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  async function cancelLateNotice() {
    if (!activeLate) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await postJson(`/api/late/${activeLate.id}`, { action: "cancel" });
      setNotice("lateCancelled");
      setStep("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  async function removeStudents(studentIds: string[], note?: string) {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/trips/${trip.id}/remove-students`, { studentIds, note });
      setRemovingKids(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.noActive);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhoneShell paper={Boolean(session && guardian && !trip && step === "home" && tab === "home")}>
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <Link href="/" className="rounded-lg">
          <BrandRow />
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold tracking-wide text-forest"
        >
          <Globe className="h-3.5 w-3.5" />
          {t.language}
        </button>
      </header>

      <div ref={contentRef} className="flex-1 overflow-y-auto px-5 pb-8">
        {notice && step === "home" && tab === "home" ? <p role="status" className="mb-4 rounded-2xl bg-forest/10 p-3 text-sm text-forest">{t[notice]}</p> : null}
        {error && step === "home" ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
        {session && snapshot && guardian && tab !== "settings" && toastNotice && step === "home" && !trip ? (
          <div className="mb-4 flex w-full items-start gap-3 rounded-2xl border border-line bg-paper px-3.5 py-3 shadow-[0_10px_30px_rgb(18_56_45/0.12)]">
            <button
              type="button"
              onClick={() => void openAnnouncement(toastNotice.id)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-paper">
                <Megaphone className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">{t.noticeFromSchool}</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-forest">{toastNotice.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{toastNotice.subtitle || toastNotice.body}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label={t.back}
              onClick={() => setDismissedNoticeIds((current) => [...current, toastNotice.id])}
              className="rounded-full px-2 py-1 text-xs font-semibold text-muted"
            >
              ✕
            </button>
          </div>
        ) : null}
        {session && snapshot && guardian && tab !== "settings" ? (
          <AuthorizationInbox snapshot={snapshot} guardian={guardian} locale={locale} t={t} />
        ) : null}
        {session && activeLate && step !== "late" ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLateMode("edit");
              setStep("late");
            }}
            className="mt-2 mb-4 flex w-full items-center gap-3 rounded-2xl border border-gold/50 bg-gold/15 px-4 py-3 text-left"
          >
            <AlarmClock className="h-5 w-5 shrink-0 text-gold-deep" />
            <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-forest-deep">
              {t.lateActiveBanner
                .replace(
                  "{names}",
                  (snapshot?.students ?? [])
                    .filter((student) => activeLate.studentIds.includes(student.id))
                    .map((student) => student.firstName)
                    .join(", "),
                )
                .replace("{time}", formatTime(activeLate.etaAt, locale))}
            </span>
            <span className="mt-1 block text-xs text-muted">{activeLate.pickerName}</span>
            <span className="mt-2 block text-xs font-semibold text-gold-deep">{t.lateUpdate} →</span>
            </span>
          </button>
        ) : null}

        {!session ? (
          <ParentLogin t={t} onSignedIn={setSession} />
        ) : syncError && !snapshot ? (
          <SystemStatus kind="error" context="familia" detail={syncError} onRetry={retry} />
        ) : !snapshot ? (
          <SystemStatus
            kind={loadingSlow ? "stuck" : "loading"}
            context="familia"
            onRetry={loadingSlow ? retry : undefined}
          />
        ) : !guardian ? (
          <SystemStatus
            kind="error"
            context="familia"
            title="No encontramos tu familia"
            body="Cierra sesión e ingresa de nuevo con tu usuario."
            onRetry={clearSession}
            retryLabel="Cerrar sesión"
          />
        ) : tab === "settings" ? (
          <ParentSettings
            snapshot={snapshot}
            guardian={guardian}
            locale={locale}
            t={t}
            onLogout={clearSession}
          />
        ) : step === "late" ? (
          <ParentLate
            snapshot={snapshot}
            guardian={guardian}
            locale={locale}
            t={t}
            busy={busy}
            error={error}
            key={lateMode === "edit" ? activeLate?.id : "create"}
            existing={lateMode === "edit" ? activeLate : null}
            initialTrip={activeTrip}
            jornada={jornada}
            onBack={() => setStep("home")}
            onSubmit={submitLate}
            onEtaUpdate={updateLateEta}
            onCancelNotice={cancelLateNotice}
          />
        ) : step === "avisos" ? (
          <ParentAnnouncements
            snapshot={snapshot}
            guardian={guardian}
            locale={locale}
            t={t}
            selectedId={openAnnouncementId}
            onOpen={(id) => void openAnnouncement(id)}
            onBack={() => {
              if (openAnnouncementId) setOpenAnnouncementId(null);
              else setStep("home");
            }}
          />
        ) : step === "calendario" ? (
          <ParentCalendar
            snapshot={snapshot}
            locale={locale}
            t={t}
            onBack={() => setStep("home")}
          />
        ) : trip && tripArrived ? (
          <ParentTracker
            snapshot={snapshot}
            trip={trip}
            locale={locale}
            t={t}
            unreadCount={unread.length}
            onCancel={() => cancelTrip(trip.id)}
            onRemoveKids={removableRequests.length > 0 ? () => {
              setError(null);
              setRemovingKids(true);
            } : undefined}
            onStartOver={() => {
              setDismissedTripId(trip.id);
              setSelected([]);
              setStep("home");
            }}
            onAvisos={() => {
              setOpenAnnouncementId(null);
              setStep("avisos");
            }}
            onCalendar={() => setStep("calendario")}
            busy={busy}
          />
        ) : step === "setup" ? (
          <ParentSetup
            snapshot={snapshot}
            guardian={guardian}
            selectedIds={selected}
            locale={locale}
            t={t}
            busy={busy}
            error={error}
            onBack={() => setStep("home")}
            onSubmit={saveTrip}
            initialTrip={trip}
          />
        ) : trip && step === "home" ? (
          <ParentPlanToday
            key={trip.id}
            busy={busy}
            onCancel={() => cancelTrip(trip.id)}
            snapshot={snapshot}
            guardian={guardian}
            trip={trip}
            locale={locale}
            t={t}
            unreadCount={unread.length}
            onChange={() => {
              setSelected(activeTripRequests.map((request) => request.studentId));
              setStep("select");
            }}
            onFriends={friendsChildren.length ? () => {
              setSelected(activeTripRequests.map((request) => request.studentId));
              setStep("select");
            } : undefined}
            onLate={() => {
              setError(null);
              setLateMode(activeLate ? "edit" : "create");
              setStep("late");
            }}
            onAvisos={() => {
              setOpenAnnouncementId(null);
              setStep("avisos");
            }}
            onCalendar={() => setStep("calendario")}
          />
        ) : step === "home" ? (
          <ParentDashboard
            guardian={guardian}
            childrenList={children}
            locale={locale}
            t={t}
            now={now}
            hasLate={Boolean(activeLate)}
            unreadCount={unread.length}
            onCreate={() => {
              setSelected([]);
              setError(null);
              setNotice(null);
              setStep("select");
            }}
            onLate={() => {
              setError(null);
              setNotice(null);
              setLateMode(activeLate ? "edit" : "create");
              setStep("late");
            }}
            onAvisos={() => {
              setOpenAnnouncementId(null);
              setStep("avisos");
            }}
            onCalendar={() => setStep("calendario")}
          />
        ) : (
          <ParentHome
            guardian={guardian}
            childrenList={children}
            friendsChildren={friendsChildren}
            selected={selected}
            onToggle={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
              )
            }
            onContinue={() => {
              setError(null);
              setStep("setup");
            }}
            onBack={() => setStep("home")}
            onLate={() => {
              setError(null);
              setLateMode(activeLate ? "edit" : "create");
              setStep("late");
            }}
            lateLabel={activeLate ? t.lateUpdate : t.lateCta}
            locale={locale}
            t={t}
          />
        )}
      </div>

      {removingKids && trip ? (
        <RemoveFromPickupSheet
          snapshot={snapshot!}
          requests={removableRequests}
          t={t}
          busy={busy}
          error={error}
          onClose={() => setRemovingKids(false)}
          onConfirm={removeStudents}
        />
      ) : null}

      {showNav ? (
        <nav className="grid grid-cols-2 border-t border-line bg-paper">
          <button
            type="button"
            onClick={() => {
              setTab("home");
            }}
            className={`flex flex-col items-center gap-1 py-3 text-xs font-semibold ${
              tab === "home" ? "text-forest" : "text-muted"
            }`}
          >
            <House className="h-5 w-5" />
            {t.home}
          </button>
          <button
            type="button"
            onClick={() => setTab("settings")}
            className={`flex flex-col items-center gap-1 py-3 text-xs font-semibold ${
              tab === "settings" ? "text-forest" : "text-muted"
            }`}
          >
            <UserRound className="h-5 w-5" />
            {t.settings}
          </button>
        </nav>
      ) : null}
    </PhoneShell>
  );
}
