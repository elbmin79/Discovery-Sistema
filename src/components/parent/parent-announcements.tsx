"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, Megaphone } from "lucide-react";
import { formatTime } from "@/lib/school";
import {
  ANNOUNCEMENT_ARCHIVE_PAGE_SIZE,
  announcementDayLabel,
  groupAnnouncementsByDay,
  splitAnnouncements,
} from "@/lib/school-comms";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guardian, Locale, SchoolAnnouncement, Snapshot } from "@/lib/types";

type ListTab = "recent" | "previous";

export function ParentAnnouncements({
  snapshot,
  guardian,
  locale,
  t,
  selectedId,
  onOpen,
  onBack,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  locale: Locale;
  t: Dictionary;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.closest(".overflow-y-auto")?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [selectedId]);
  const { recent, previous } = useMemo(() => splitAnnouncements(snapshot), [snapshot]);
  const reads = new Set(guardian.readAnnouncementIds ?? []);
  const selected =
    [...recent, ...previous].find((item) => item.id === selectedId) ?? null;
  const [tab, setTab] = useState<ListTab>("recent");
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(previous.length / ANNOUNCEMENT_ARCHIVE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = previous.slice(
    safePage * ANNOUNCEMENT_ARCHIVE_PAGE_SIZE,
    safePage * ANNOUNCEMENT_ARCHIVE_PAGE_SIZE + ANNOUNCEMENT_ARCHIVE_PAGE_SIZE,
  );
  const dayGroups = groupAnnouncementsByDay(pageItems);
  const unreadRecent = recent.some((item) => !reads.has(item.id));
  const unreadPrevious = previous.some((item) => !reads.has(item.id));

  if (selected) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-forest">
          <ChevronLeft className="h-4 w-4" />
          {t.back}
        </button>
        <article className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">{t.announcements}</p>
          <h1 ref={heading} tabIndex={-1} className="mt-2 text-3xl text-forest outline-none">{selected.title}</h1>
          {selected.subtitle ? <p className="mt-1 text-sm font-medium text-muted">{selected.subtitle}</p> : null}
          <p className="mt-2 text-xs text-muted">
            {formatTime(selected.createdAt, locale)}
            {selected.authorName ? ` · ${selected.authorName}` : ""}
          </p>
          {selected.photoUrl ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-cream">
              <Image src={selected.photoUrl} alt="" width={720} height={480} unoptimized className="h-auto w-full object-cover" />
            </div>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">{selected.body}</p>
        </article>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-forest">
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </button>
      <div>
        <h1 ref={heading} tabIndex={-1} className="text-3xl text-forest outline-none">{t.announcements}</h1>
        <p className="mt-1 text-sm text-muted">{t.announcementsHint}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-cream/60 p-1">
        <ListTabButton
          active={tab === "recent"}
          label={t.announcementsRecent}
          badge={unreadRecent}
          onClick={() => setTab("recent")}
        />
        <ListTabButton
          active={tab === "previous"}
          label={t.announcementsPrevious}
          badge={unreadPrevious}
          onClick={() => setTab("previous")}
        />
      </div>

      {tab === "recent" ? (
        recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-paper/60 px-4 py-8 text-center text-sm text-muted">
            {t.announcementsRecentEmpty}
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                unread={!reads.has(item.id)}
                locale={locale}
                t={t}
                onOpen={() => onOpen(item.id)}
              />
            ))}
          </div>
        )
      ) : previous.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-paper/60 px-4 py-8 text-center text-sm text-muted">
          {t.announcementsPreviousEmpty}
        </p>
      ) : (
        <div className="space-y-4">
          {dayGroups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold tracking-[0.12em] text-muted uppercase">
                {announcementDayLabel(group.labelIso, locale)}
              </h2>
              {group.items.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  unread={!reads.has(item.id)}
                  locale={locale}
                  t={t}
                  onOpen={() => onOpen(item.id)}
                />
              ))}
            </section>
          ))}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="min-h-10 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-forest disabled:opacity-40"
              >
                {t.announcementsPrevPage}
              </button>
              <p className="text-xs font-medium text-muted">
                {t.announcementsPageOf
                  .replace("{page}", String(safePage + 1))
                  .replace("{total}", String(totalPages))}
              </p>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                className="min-h-10 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-forest disabled:opacity-40"
              >
                {t.announcementsNextPage}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ListTabButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-10 rounded-xl text-sm font-semibold transition ${
        active ? "bg-forest text-paper shadow-sm" : "text-forest"
      }`}
    >
      {label}
      {badge ? (
        <span className={`absolute top-1.5 right-2 h-2 w-2 rounded-full ${active ? "bg-gold" : "bg-danger"}`} />
      ) : null}
    </button>
  );
}

function AnnouncementCard({
  item,
  unread,
  locale,
  t,
  onOpen,
}: {
  item: SchoolAnnouncement;
  unread: boolean;
  locale: Locale;
  t: Dictionary;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
        unread ? "border-gold/50 bg-gold/10" : "border-line bg-paper"
      }`}
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${unread ? "bg-gold/25 text-gold-deep" : "bg-cream text-forest"}`}>
        <Megaphone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold text-forest">{item.title}</span>
          {unread ? <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-paper uppercase">{t.newBadge}</span> : null}
        </span>
        {item.subtitle ? <span className="mt-0.5 block truncate text-xs text-muted">{item.subtitle}</span> : null}
        <span className="mt-1 block text-[11px] text-muted">{formatTime(item.createdAt, locale)}</span>
      </span>
    </button>
  );
}
