"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DemoAccount } from "@/lib/auth/accounts";

const ITEM_H = 40;
const VISIBLE = 3;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

export function QuickAccountSelect({
  accounts,
  value,
  onChange,
  label = "Cuenta rápida",
  placeholder = "Elige una cuenta…",
  noneLabel = "Ninguna",
  familyHint = false,
}: {
  accounts: DemoAccount[];
  value: string;
  onChange: (account: DemoAccount | null) => void;
  label?: string;
  placeholder?: string;
  noneLabel?: string;
  familyHint?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const accountsRef = useRef(accounts);
  const onChangeRef = useRef(onChange);
  const selected = accounts.find((item) => item.username === value) ?? null;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const accountKey = accounts.map((item) => item.username).join("|");

  const rows = [
    { key: "", title: noneLabel, subtitle: "Sin cuenta rápida", account: null as DemoAccount | null },
    ...accounts.map((account) => ({
      key: account.username,
      title: account.name,
      subtitle: familyHint ? `Familia ${account.name.split(" ").slice(-1)[0]}` : account.username,
      account,
    })),
  ];

  useEffect(() => {
    accountsRef.current = accounts;
    onChangeRef.current = onChange;
  }, [accounts, onChange]);

  function setIndex(next: number) {
    activeIndexRef.current = next;
    setActiveIndex(next);
  }

  function pick(index: number) {
    const list = accountsRef.current;
    const safe = Math.max(0, Math.min(list.length, index));
    if (safe <= 0) {
      onChangeRef.current(null);
    } else {
      onChangeRef.current(list[safe - 1] ?? null);
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const node = scrollerRef.current;
    if (!node) return;
    const usernames = accountKey ? accountKey.split("|") : [];
    const found = usernames.indexOf(value);
    const next = found >= 0 ? found + 1 : 0;
    node.scrollTop = next * ITEM_H;
    setIndex(next);
  }, [open, value, accountKey]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      pick(activeIndexRef.current);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = scrollerRef.current;
    if (!node) return;
    const scroller = node;
    const total = (accountKey ? accountKey.split("|").length : 0) + 1;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0;
      if (!direction) return;
      const next = Math.max(0, Math.min(total - 1, activeIndexRef.current + direction));
      scroller.scrollTo({ top: next * ITEM_H, behavior: "smooth" });
      setIndex(next);
    }

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [open, accountKey]);

  function onScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    const total = rows.length;
    const index = Math.max(0, Math.min(total - 1, Math.round(node.scrollTop / ITEM_H)));
    if (index !== activeIndexRef.current) setIndex(index);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-center justify-center rounded-3xl border border-line bg-paper px-4 py-3.5 text-center"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
          {label}
          <ChevronDown className="h-4 w-4 text-muted" />
        </span>
        <span className="mt-0.5 max-w-full truncate text-sm text-muted">
          {selected ? selected.name : placeholder}
        </span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="rounded-3xl border border-forest/30 bg-paper p-2">
      <div
        className="relative overflow-hidden rounded-2xl bg-cream"
        style={{ height: VISIBLE * ITEM_H }}
      >
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border border-forest/25 bg-forest/10" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 bg-gradient-to-b from-cream to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-cream to-transparent" />

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="account-wheel no-scrollbar h-full overflow-y-auto overscroll-contain"
          style={{
            paddingTop: PAD,
            paddingBottom: PAD,
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
          role="listbox"
          aria-label={label}
          tabIndex={0}
        >
          {rows.map((row, index) => {
            const isActive = index === activeIndex;
            const distance = Math.abs(index - activeIndex);
            return (
              <button
                key={row.key || "none"}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => pick(index)}
                className="flex w-full flex-col items-center justify-center px-3 text-center"
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: "center",
                  opacity: isActive ? 1 : Math.max(0.28, 1 - distance * 0.35),
                }}
              >
                <span className={`truncate text-sm font-semibold ${isActive ? "text-forest" : "text-muted"}`}>
                  {row.title}
                </span>
                <span className={`truncate text-[11px] ${isActive ? "text-gold-deep" : "text-muted/70"}`}>
                  {row.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
