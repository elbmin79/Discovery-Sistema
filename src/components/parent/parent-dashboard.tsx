"use client";

import { AlarmClock, ArrowUpRight, CalendarDays, ChevronRight, Megaphone, Phone } from "lucide-react";
import { SCHOOL, SCHOOL_TIMEZONE, greeting } from "@/lib/school";
import { StudentAvatar } from "@/components/ui/avatar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

export function SchoolContact({ t }: { t: Dictionary }) {
  return (
    <a href={SCHOOL.phoneHref} className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-paper p-4 text-forest">
      <Phone className="h-5 w-5 shrink-0" />
      <span className="flex-1"><span className="block text-sm font-semibold">{t.contactSchool}</span><span className="text-xs text-muted">{SCHOOL.phone}</span></span>
      <ArrowUpRight className="h-4 w-4" />
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
    <div className="flex flex-col gap-5 pb-3">
      <header className="pt-2">
        <p className="text-sm text-muted">{greeting(locale)},</p>
        <h1 className="font-serif text-4xl text-forest">{guardian.firstName}</h1>
        <p className="mt-2 text-sm capitalize text-muted">{now.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { timeZone: SCHOOL_TIMEZONE, weekday: "long", month: "long", day: "numeric" })}</p>
      </header>
      <section className="overflow-hidden rounded-3xl bg-forest p-5 text-paper">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-cream"><CalendarDays className="h-4 w-4" />{t.homeToday}</div>
        <h2 className="mt-4 max-w-64 font-serif text-2xl leading-tight">{t.noPlanToday}</h2>
        <p className="mt-2 text-sm text-cream">{t.createPickupHint}</p>
        <div className="my-5 space-y-3 border-y border-paper/20 py-4">
          {childrenList.map((child) => <div key={child.id} className="flex items-center gap-3"><StudentAvatar student={child} size="sm" /><span className="flex-1 text-sm font-semibold">{child.firstName}</span><span className="text-sm tabular-nums text-cream">{child.dismissalTime}</span></div>)}
        </div>
        <button onClick={onCreate} className="flex min-h-12 w-full items-center justify-between rounded-full bg-paper px-5 font-semibold text-forest">{t.createPickup}<ChevronRight className="h-5 w-5" /></button>
      </section>
      <button onClick={onLate} className="flex min-h-24 items-start gap-3 rounded-3xl border border-gold/50 bg-gold/10 p-5 text-left">
        <AlarmClock className="mt-1 h-6 w-6 shrink-0 text-gold-deep" />
        <span className="flex-1"><span className="block text-base font-semibold text-forest">{hasLate ? t.lateUpdate : t.lateCta}</span><span className="mt-1 block text-sm text-muted">{t.lateHomeHint}</span></span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold-deep" />
      </button>
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-forest"><Megaphone className="h-4 w-4" />{t.announcements}</h2>
        <p className="mt-3 text-sm text-muted">{t.announcementsSoon}</p>
      </section>
      <div><p className="mb-2 text-center text-xs text-muted">{t.contactHint}</p><SchoolContact t={t} /></div>
    </div>
  );
}
