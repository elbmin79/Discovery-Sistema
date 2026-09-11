"use client";

import Image from "next/image";
import { ArrowRight, CalendarDays, ChevronRight, Clock3, Megaphone, Phone } from "lucide-react";
import { LEVEL_LABELS, SCHOOL, SCHOOL_TIMEZONE } from "@/lib/school";
import { StudentAvatar } from "@/components/ui/avatar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

export function SchoolContact({ t }: { t: Dictionary }) {
  return (
    <a href={SCHOOL.phoneHref} className="group flex min-h-14 items-center gap-3 rounded-xl border border-[#e7e5df] bg-white/40 px-3.5 py-3 text-forest transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
      <Phone className="h-6 w-6 shrink-0" strokeWidth={1.6} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{t.contactSchool}</span><span className="mt-0.5 block text-xs tabular-nums text-muted">{SCHOOL.phone}</span></span>
      <ChevronRight className="h-5 w-5" strokeWidth={1.6} />
    </a>
  );
}

export function ParentDashboard({
  guardian,
  childrenList,
  locale,
  t,
  now,
  hasLate,
  unreadCount,
  onCreate,
  onLate,
  onAvisos,
  onCalendar,
}: {
  guardian: Guardian;
  childrenList: Student[];
  locale: Locale;
  t: Dictionary;
  now: Date;
  hasLate: boolean;
  unreadCount: number;
  onCreate: () => void;
  onLate: () => void;
  onAvisos: () => void;
  onCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pb-1">
      <header className="relative grid min-h-24 grid-cols-[minmax(0,1fr)_96px] items-center gap-1 pt-2 min-[400px]:grid-cols-[minmax(0,1fr)_112px]">
        <div className="relative z-10">
          <p className="mb-1.5 text-xs font-medium text-muted">{now.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { timeZone: SCHOOL_TIMEZONE, weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-[31px] leading-[1.08] tracking-[-0.028em] text-[#102e27] min-[400px]:text-[33px]">{t.homeHello.replace("{name}", guardian.firstName)}</h1>
          <p className="mt-1 text-sm leading-snug text-[#565b50]">{t.homeWelcome}</p>
        </div>
        <Image src="/illustrations/school-welcome.png" alt="" width={240} height={240} sizes="120px" className="w-full self-end object-contain pb-1 mix-blend-multiply" priority />
      </header>

      <section aria-label={t.dismissal}>
        <div className="mb-2.5 flex items-center gap-3">
          <h2 className="shrink-0 text-[19px] font-semibold tracking-[-0.02em] text-[#102e27]">{t.homeChildrenToday}</h2>
          <span className="h-px flex-1 bg-[#dcdcd4]" />
        </div>
        <div className="flex flex-col gap-2">
          {childrenList.map((child) => (
            <div key={child.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line/60 px-3 py-2.5">
              <StudentAvatar student={child} size="lg" />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-[#172c26]">{child.firstName} {child.lastName}</p>
                <p className="mt-0.5 text-xs leading-tight text-muted">{LEVEL_LABELS[child.level][locale]}</p>
                <p className="mt-0.5 text-base font-semibold whitespace-nowrap tabular-nums tracking-tight text-[#172c26]">{child.dismissalTime}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t.homeToday} className="relative overflow-hidden rounded-xl border border-[#e7e5df] bg-white/50 p-3.5">
        <p className="flex items-center gap-2 text-xs text-[#5b7766]"><span className="h-1.5 w-1.5 rounded-full bg-[#adb9ac]" />{t.homeNoPlan}</p>
        <div className="relative mt-2 pr-14 min-[400px]:pr-16">
          <h2 className="text-[25px] leading-[1.15] tracking-[-0.028em] text-[#102e27]">{t.homePickupTitle}</h2>
          <p className="mt-1 text-sm leading-snug text-muted">{t.homePickupHint}</p>
          <Image src="/illustrations/pickup-pass.png" alt="" width={160} height={160} sizes="80px" className="absolute -top-3 -right-2 h-16 w-16 object-contain" />
        </div>
        <button type="button" onClick={onCreate} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-paper shadow-[inset_0_1px_0_#ffffff12] transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">{t.createPickup}<ArrowRight className="h-4 w-4" /></button>
      </section>

      <button type="button" aria-label={hasLate ? t.lateUpdate : t.lateCta} onClick={onLate} className="flex min-h-14 items-center gap-3 rounded-xl border border-[#e7e5df] bg-white/40 px-3.5 py-3 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep">
        <Clock3 className="h-6 w-6 shrink-0 text-[#d1a146]" strokeWidth={1.7} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{hasLate ? t.lateUpdate : t.homeLateTitle}</span><span className="mt-0.5 block text-xs text-muted">{t.homeLateHint}</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 text-forest" strokeWidth={1.6} />
      </button>

      <ParentSchoolNews t={t} unreadCount={unreadCount} onAvisos={onAvisos} onCalendar={onCalendar} />
      <SchoolContact t={t} />
    </div>
  );
}

export function ParentSchoolNews({
  t,
  unreadCount,
  onAvisos,
  onCalendar,
}: {
  t: Dictionary;
  unreadCount: number;
  onAvisos: () => void;
  onCalendar: () => void;
}) {
  return (
    <section aria-label={t.homeSchoolNews}>
      <div className="mb-2.5 flex items-center gap-3">
        <h2 className="shrink-0 text-[19px] font-semibold tracking-[-0.02em] text-[#102e27]">{t.homeSchoolNews}</h2>
        <span className="h-px flex-1 bg-[#dcdcd4]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-announcements-launcher
          onClick={onAvisos}
          className="relative flex min-h-[4.75rem] flex-col items-start justify-between rounded-xl border border-[#e7e5df] bg-white/50 p-3 text-left transition hover:bg-white"
        >
          <Megaphone className="h-5 w-5 text-forest" strokeWidth={1.5} />
          <span>
            <span className="block text-sm font-semibold text-forest">{t.schoolAvisos}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.schoolAvisosHint}</span>
          </span>
          {unreadCount > 0 ? (
            <span className="absolute top-2.5 right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-paper">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onCalendar}
          className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-xl border border-[#e7e5df] bg-white/50 p-3 text-left transition hover:bg-white"
        >
          <CalendarDays className="h-5 w-5 text-forest" strokeWidth={1.5} />
          <span>
            <span className="block text-sm font-semibold text-forest">{t.schoolCalendar}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.schoolCalendarHint}</span>
          </span>
        </button>
      </div>
    </section>
  );
}
