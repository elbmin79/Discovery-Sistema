"use client";

import { AlarmClock, ArrowUpRight, CalendarDays, Clock3, Megaphone, Phone, Plus } from "lucide-react";
import { SCHOOL, SCHOOL_TIMEZONE, greeting } from "@/lib/school";
import { StudentAvatar } from "@/components/ui/avatar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

export function SchoolContact({ t }: { t: Dictionary }) {
  return (
    <a href={SCHOOL.phoneHref} className="group flex min-h-16 items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-forest ring-1 ring-line/60 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream"><Phone className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.contactSchool}</span><span className="text-xs tabular-nums text-muted">{SCHOOL.phone}</span></span>
      <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
    </a>
  );
}

export function ParentDashboard({ guardian, childrenList, locale, t, now, hasLate, onCreate, onLate }: {
  guardian: Guardian;
  childrenList: Student[];
  locale: Locale;
  t: Dictionary;
  now: Date;
  hasLate: boolean;
  onCreate: () => void;
  onLate: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 pb-2">
      <header className="pt-2">
        <p className="text-sm text-muted">{greeting(locale)},</p>
        <h1 className="mt-1 font-sans! text-3xl font-semibold tracking-tight text-ink">{guardian.firstName}</h1>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" />{now.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { timeZone: SCHOOL_TIMEZONE, weekday: "long", month: "long", day: "numeric" })}</p>
      </header>
      <section aria-label={t.dismissal}>
        <h2 className="mb-3 font-sans! text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t.homeDismissal}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {childrenList.map((child) => (
            <div key={child.id} className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-paper p-3 ring-1 ring-line/60">
              <StudentAvatar student={child} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{child.firstName}</p>
                <p className="mt-1 text-xs whitespace-nowrap tabular-nums text-muted">{child.dismissalTime}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section aria-label={t.homeToday}>
        <div className="mb-3 flex items-center gap-2 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-muted/50" />{t.homeNoPlan}</div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" aria-label={t.createPickup} onClick={onCreate} className="group flex min-h-44 flex-col items-start rounded-3xl bg-[#e8eee8] p-4 text-left ring-1 ring-forest/15 transition-colors hover:bg-[#dfe9df] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
            <span className="mb-5 flex w-full items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest text-paper"><Plus className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-forest/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" /></span>
            <span className="text-base leading-snug font-semibold tracking-tight text-forest">{t.createPickup}</span>
            <span className="mt-2 text-xs leading-relaxed text-muted">{t.homePickupHint}</span>
          </button>
          <button type="button" aria-label={hasLate ? t.lateUpdate : t.lateCta} onClick={onLate} className="group flex min-h-44 flex-col items-start rounded-3xl bg-paper p-4 text-left ring-1 ring-line/60 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep">
            <span className="mb-5 flex w-full items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold-deep"><AlarmClock className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" /></span>
            <span className="text-base leading-snug font-semibold tracking-tight text-ink">{hasLate ? t.lateUpdate : t.homeLateTitle}</span>
            <span className="mt-2 text-xs leading-relaxed text-muted">{t.homeLateHint}</span>
          </button>
        </div>
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-sans! text-sm font-semibold text-ink"><Megaphone className="h-4 w-4 text-muted" />{t.announcements}</h2>
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-5">
          <Clock3 className="h-5 w-5 shrink-0 text-muted/60" />
          <p className="text-xs leading-relaxed text-muted">{t.announcementsSoon}</p>
        </div>
      </section>
      <SchoolContact t={t} />
    </div>
  );
}
