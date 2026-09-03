"use client";

import { StudentAvatar } from "@/components/ui/avatar";
import { greeting, studentGrade, studentName } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

export function ParentHome({
  guardian,
  childrenList,
  selected,
  onToggle,
  onContinue,
  onLate,
  lateLabel,
  locale,
  t,
}: {
  guardian: Guardian;
  childrenList: Student[];
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onLate?: () => void;
  lateLabel?: string;
  locale: Locale;
  t: Dictionary;
}) {
  const allSelected = selected.length === childrenList.length && childrenList.length > 0;
  const label =
    selected.length === 0
      ? t.selectChildren
      : selected.length === 1
        ? t.goForOne.replace(
            "{name}",
            childrenList.find((child) => child.id === selected[0])?.firstName ?? "",
          )
        : allSelected
          ? t.goForAll
          : t.goForCount.replace("{count}", String(selected.length));

  return (
    <div className="flex min-h-full flex-col">
      <p className="text-sm text-muted">{greeting(locale)},</p>
      <h1 className="font-serif text-4xl text-forest">{guardian.firstName}</h1>
      <p className="mt-6 text-xs font-semibold tracking-[0.16em] uppercase text-gold-deep">
        {t.children}
      </p>
      <p className="mt-1 text-sm text-muted">{t.registered}</p>

      <div className="mt-4 space-y-3">
        {childrenList.map((child) => {
          const active = selected.includes(child.id);
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onToggle(child.id)}
              className={`flex w-full items-center gap-4 rounded-3xl border px-4 py-4 text-left transition ${
                active ? "border-forest bg-paper" : "border-line bg-paper/70"
              }`}
            >
              <StudentAvatar student={child} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-ink">{studentName(child)}</p>
                <p className="text-sm text-muted">{studentGrade(child, locale)}</p>
              </div>
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

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={onContinue}
        className="mt-8 w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-40"
      >
        {label}
      </button>

      {onLate ? (
        <button
          type="button"
          onClick={onLate}
          className="mt-3 w-full rounded-full border border-dashed border-gold-deep/60 py-3 text-sm font-semibold text-gold-deep"
        >
          {lateLabel ?? t.lateCta}
        </button>
      ) : null}
    </div>
  );
}
