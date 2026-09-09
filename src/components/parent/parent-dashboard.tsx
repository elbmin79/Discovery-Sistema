"use client";

import Image from "next/image";
import { ArrowRight, ChevronRight, Clock3, Megaphone, Phone } from "lucide-react";
import { LEVEL_LABELS, SCHOOL, SCHOOL_TIMEZONE } from "@/lib/school";
import { StudentAvatar } from "@/components/ui/avatar";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

export function SchoolContact({ t }: { t: Dictionary }) {
  return (
    <a href={SCHOOL.phoneHref} className="group flex min-h-16 items-center gap-4 rounded-xl border border-[#e7e5df] bg-white/40 px-4 py-3.5 text-forest transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
      <Phone className="h-6 w-6 shrink-0" strokeWidth={1.6} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{t.contactSchool}</span><span className="mt-0.5 block text-xs tabular-nums text-muted">{SCHOOL.phone}</span></span>
      <ChevronRight className="h-5 w-5" strokeWidth={1.6} />
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
    <div className="flex flex-col gap-4 pb-1">
      <header className="relative -mb-2 grid min-h-32 grid-cols-[minmax(0,1fr)_112px] items-center gap-1 pt-3 min-[400px]:grid-cols-[minmax(0,1fr)_128px]">
        <div className="relative z-10">
          <p className="mb-3 text-[9px] font-medium tracking-[0.12em] text-muted uppercase min-[400px]:text-[10px]">{now.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { timeZone: SCHOOL_TIMEZONE, weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="font-serif text-[30px] leading-[1.05] tracking-[-0.045em] text-[#102e27] min-[400px]:text-[34px]">{t.homeHello.replace("{name}", guardian.firstName)}</h1>
          <p className="mt-2 text-[13px] leading-snug text-[#565b50]">{t.homeWelcome}</p>
        </div>
        <Image src="/illustrations/school-welcome.png" alt="" width={240} height={240} sizes="120px" className="w-full self-end object-contain pb-1 mix-blend-multiply" priority />
      </header>

      <section aria-label={t.dismissal} className="pb-1">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="shrink-0 font-serif text-[22px] tracking-tight text-[#102e27]">{t.homeChildrenToday}</h2>
          <span className="h-px flex-1 bg-[#dcdcd4]" />
        </div>
        <div className="grid grid-cols-2 gap-y-4">
          {childrenList.map((child, index) => (
            <div key={child.id} className={`flex min-w-0 items-center gap-2.5 ${index % 2 ? "border-l border-[#deded5] pl-3" : "pr-2"}`}>
              <StudentAvatar student={child} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#172c26]">{child.firstName}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted">{LEVEL_LABELS[child.level][locale]}</p>
                <p className="mt-1 text-[16px] font-semibold whitespace-nowrap tabular-nums tracking-tight text-[#172c26]">{child.dismissalTime}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t.homeToday} className="relative overflow-hidden rounded-xl border border-[#e7e5df] bg-white/50 p-4">
        <p className="flex items-center gap-2 text-[11px] text-[#5b7766]"><span className="h-2 w-2 rounded-full bg-[#adb9ac]" />{t.homeNoPlan}</p>
        <div className="relative mt-3 pr-14 min-[400px]:pr-16">
          <h2 className="font-serif text-[24px] leading-[1.12] tracking-[-0.04em] text-[#102e27] min-[400px]:text-[27px]">{t.homePickupTitle}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t.homePickupHint}</p>
          <Image src="/illustrations/pickup-pass.png" alt="" width={160} height={160} sizes="80px" className="absolute -top-3 -right-2 h-20 w-20 object-contain" />
        </div>
        <button type="button" onClick={onCreate} className="mt-4 flex min-h-11 w-full items-center justify-center gap-3 rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-paper shadow-[inset_0_1px_0_#ffffff12] transition-colors hover:bg-forest-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">{t.createPickup}<ArrowRight className="h-4 w-4" /></button>
      </section>

      <button type="button" aria-label={hasLate ? t.lateUpdate : t.lateCta} onClick={onLate} className="flex min-h-16 items-center gap-4 rounded-xl border border-[#e7e5df] bg-white/40 px-4 py-3.5 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep">
        <Clock3 className="h-8 w-8 shrink-0 text-[#d1a146]" strokeWidth={1.7} />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink">{hasLate ? t.lateUpdate : t.homeLateTitle}</span><span className="mt-0.5 block text-xs text-muted">{t.homeLateHint}</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 text-forest" strokeWidth={1.6} />
      </button>

      <section className="pt-1" aria-label={t.announcements}>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="shrink-0 font-serif text-[23px] tracking-tight text-[#102e27]">{t.homeSchoolNews}</h2>
          <span className="h-px flex-1 bg-[#dcdcd4]" />
        </div>
        <div className="flex items-center gap-5 rounded-xl border border-[#e7e5df] bg-[#f5f4ef]/70 px-5 py-4">
          <Megaphone className="h-8 w-8 shrink-0 -rotate-12 text-[#839a84]" strokeWidth={1.4} />
          <div>
            <span className="inline-block rounded-full bg-[#eae7d9] px-2.5 py-1 text-[9px] font-medium tracking-[0.14em] text-[#53664c] uppercase">{t.homeComingSoon}</span>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t.homeNewsPlaceholder}</p>
          </div>
        </div>
      </section>
      <SchoolContact t={t} />
    </div>
  );
}
