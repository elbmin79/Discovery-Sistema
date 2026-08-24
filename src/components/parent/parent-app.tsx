"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe, House, UserRound } from "lucide-react";
import { BrandRow } from "@/components/brand/brand-mark";
import { PhoneShell } from "@/components/parent/phone-shell";
import { ParentHome } from "@/components/parent/parent-home";
import { ParentLogin } from "@/components/parent/parent-login";
import { ParentSettings } from "@/components/parent/parent-settings";
import { ParentSetup } from "@/components/parent/parent-setup";
import { ParentTracker } from "@/components/parent/parent-tracker";
import { useLocale } from "@/hooks/use-locale";
import { useSession } from "@/hooks/use-session";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import type { CreateTripInput, Snapshot } from "@/lib/types";

function activeTripForGuardian(snapshot: Snapshot, guardianId: string) {
  return snapshot.trips.find((trip) => {
    if (trip.guardianId !== guardianId || trip.cancelledAt) return false;
    return snapshot.requests.some(
      (request) =>
        request.tripId === trip.id &&
        request.status !== "cancelled" &&
        request.status !== "delivered",
    );
  });
}

function completedTripForGuardian(snapshot: Snapshot, guardianId: string) {
  return snapshot.trips.find((trip) => {
    if (trip.guardianId !== guardianId || trip.cancelledAt) return false;
    const requests = snapshot.requests.filter((request) => request.tripId === trip.id);
    return requests.length > 0 && requests.every((request) => request.status === "delivered");
  });
}

export function ParentApp() {
  const { snapshot } = useSnapshot();
  const { locale, t, toggle } = useLocale();
  const { session, setSession, clearSession } = useSession("parent");
  const [tab, setTab] = useState<"home" | "settings">("home");
  const [step, setStep] = useState<"home" | "setup">("home");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedTripId, setDismissedTripId] = useState<string | null>(null);

  const guardian = snapshot?.guardians.find((item) => item.id === session?.guardianId);
  const children = useMemo(
    () => snapshot?.students.filter((student) => guardian?.studentIds.includes(student.id)) ?? [],
    [snapshot, guardian],
  );
  const activeTrip = snapshot && guardian ? activeTripForGuardian(snapshot, guardian.id) : undefined;
  const doneTrip = snapshot && guardian ? completedTripForGuardian(snapshot, guardian.id) : undefined;
  const trip = activeTrip ?? (doneTrip && doneTrip.id !== dismissedTripId ? doneTrip : undefined);
  const showNav = Boolean(session && guardian && !trip && step !== "setup");

  async function createTrip(input: Omit<CreateTripInput, "guardianId" | "studentIds">) {
    if (!guardian) return;
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/trips", {
        ...input,
        guardianId: guardian.id,
        studentIds: selected,
      });
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
    try {
      await postJson(`/api/trips/${tripId}/cancel`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhoneShell>
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

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {!session ? (
          <ParentLogin t={t} onSignedIn={setSession} />
        ) : !snapshot || !guardian ? (
          <p className="pt-10 text-center text-muted">Cargando tu cuenta…</p>
        ) : trip ? (
          <ParentTracker
            snapshot={snapshot}
            trip={trip}
            locale={locale}
            t={t}
            onCancel={() => cancelTrip(trip.id)}
            onStartOver={() => {
              setDismissedTripId(trip.id);
              setSelected([]);
              setStep("home");
            }}
            busy={busy}
          />
        ) : tab === "settings" ? (
          <ParentSettings
            snapshot={snapshot}
            guardian={guardian}
            locale={locale}
            t={t}
            onLogout={clearSession}
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
            onSubmit={createTrip}
          />
        ) : (
          <ParentHome
            guardian={guardian}
            childrenList={children}
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
            locale={locale}
            t={t}
          />
        )}
      </div>

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
