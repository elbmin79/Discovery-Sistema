"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus, X } from "lucide-react";
import { StudentAvatar } from "@/components/ui/avatar";
import { greeting, studentGrade, studentName } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, Student } from "@/lib/types";

type FriendKid = { student: Student; owner: Guardian };

export function ParentHome({
  guardian,
  childrenList,
  friendsChildren,
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
  friendsChildren: FriendKid[];
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onLate?: () => void;
  lateLabel?: string;
  locale: Locale;
  t: Dictionary;
}) {
  const [picking, setPicking] = useState(false);
  const everyone = [...childrenList, ...friendsChildren.map((item) => item.student)];
  const selectedFriendKids = friendsChildren.filter((item) => selected.includes(item.student.id));
  const allOwnSelected =
    childrenList.length > 0 && childrenList.every((child) => selected.includes(child.id));
  const onlyOwn = selected.every((id) => childrenList.some((child) => child.id === id));
  const label =
    selected.length === 0
      ? t.selectChildren
      : selected.length === 1
        ? t.goForOne.replace("{name}", everyone.find((child) => child.id === selected[0])?.firstName ?? "")
        : allOwnSelected && onlyOwn
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
        {childrenList.map((child) => (
          <KidRow
            key={child.id}
            child={child}
            detail={studentGrade(child, locale)}
            active={selected.includes(child.id)}
            onToggle={() => onToggle(child.id)}
          />
        ))}
      </div>

      {selectedFriendKids.length > 0 ? (
        <>
          <p className="mt-7 text-xs font-semibold tracking-[0.16em] uppercase text-gold-deep">
            {t.friendsKids}
          </p>
          <div className="mt-3 space-y-3">
            {selectedFriendKids.map(({ student, owner }) => (
              <KidRow
                key={student.id}
                child={student}
                detail={(student.gender === "f" ? t.kidOfF : t.kidOfM).replace(
                  "{name}",
                  `${owner.firstName} ${owner.lastName}`,
                )}
                active
                onToggle={() => onToggle(student.id)}
                removable
              />
            ))}
          </div>
        </>
      ) : null}

      {friendsChildren.length > 0 ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-forest/40 py-3 text-sm font-semibold text-forest"
        >
          <UserPlus className="h-4 w-4" />
          {t.requestFriendsKids}
        </button>
      ) : null}

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

      {picking ? (
        <FriendPicker
          friendsChildren={friendsChildren}
          selected={selected}
          onToggle={onToggle}
          onClose={() => setPicking(false)}
          locale={locale}
          t={t}
        />
      ) : null}
    </div>
  );
}

function FriendPicker({
  friendsChildren,
  selected,
  onToggle,
  onClose,
  locale,
  t,
}: {
  friendsChildren: FriendKid[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  locale: Locale;
  t: Dictionary;
}) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const families = new Map<string, { owner: Guardian; kids: Student[] }>();
  for (const { student, owner } of friendsChildren) {
    const entry = families.get(owner.id) ?? { owner, kids: [] };
    entry.kids.push(student);
    families.set(owner.id, entry);
  }
  const current = familyId ? families.get(familyId) : undefined;
  const totalSelected = friendsChildren.filter((item) => selected.includes(item.student.id)).length;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-ink/40" onClick={onClose}>
      <div
        className="max-h-[85%] overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-8 pt-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {current ? (
            <button
              type="button"
              onClick={() => setFamilyId(null)}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-forest"
              aria-label={t.back}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-gold-deep">
              {current ? `${current.owner.firstName} ${current.owner.lastName}` : t.pickFamily}
            </p>
            <p className="text-sm text-muted">{t.pickFamilyHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-forest"
            aria-label={t.done}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {current
            ? current.kids.map((kid) => (
                <KidRow
                  key={kid.id}
                  child={kid}
                  detail={studentGrade(kid, locale)}
                  active={selected.includes(kid.id)}
                  onToggle={() => onToggle(kid.id)}
                />
              ))
            : [...families.values()].map(({ owner, kids }) => {
                const count = kids.filter((kid) => selected.includes(kid.id)).length;
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => setFamilyId(owner.id)}
                    className="flex w-full items-center gap-3 rounded-3xl border border-line bg-paper px-4 py-3 text-left"
                  >
                    <div className="flex -space-x-2">
                      {kids.slice(0, 3).map((kid) => (
                        <div key={kid.id} className="rounded-full ring-2 ring-paper">
                          <StudentAvatar student={kid} size="sm" />
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {owner.firstName} {owner.lastName}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {count > 0
                          ? t.selectedCount.replace("{count}", String(count))
                          : kids.map((kid) => kid.firstName).join(", ")}
                      </p>
                    </div>
                    {count > 0 ? (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-forest px-1.5 text-xs font-semibold text-paper">
                        {count}
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </button>
                );
              })}
        </div>

        <button
          type="button"
          onClick={current ? () => setFamilyId(null) : onClose}
          className="mt-6 w-full rounded-full bg-forest py-3.5 text-base font-semibold text-paper"
        >
          {t.done}
          {!current && totalSelected > 0 ? ` · ${totalSelected}` : ""}
        </button>
      </div>
    </div>
  );
}

function KidRow({
  child,
  detail,
  active,
  onToggle,
  removable,
}: {
  child: Student;
  detail: string;
  active: boolean;
  onToggle: () => void;
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-3xl border px-4 py-4 text-left transition ${
        active ? "border-forest bg-paper" : "border-line bg-paper/70"
      }`}
    >
      <StudentAvatar student={child} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-ink">{studentName(child)}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      {removable ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-muted">
          <X className="h-4 w-4" />
        </span>
      ) : (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            active ? "border-forest bg-forest text-paper" : "border-line"
          }`}
        >
          {active ? "✓" : ""}
        </span>
      )}
    </button>
  );
}
