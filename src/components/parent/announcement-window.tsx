"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function AnnouncementWindow({ children, label, closeLabel, onClose }: {
  children: ReactNode;
  label: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); });
    };
  }, []);

  async function close() {
    if (closing.current) return;
    closing.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await panel.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 0 : 160, easing: "ease-in", fill: "forwards" }).finished.catch(() => undefined);
    onClose();
  }

  return (
    <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className="absolute inset-0 z-50 flex flex-col bg-cream" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); void close(); }
      if (event.key !== "Tab") return;
      const buttons = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="text-xl font-semibold text-forest">{label}</span>
        <button ref={closeButton} type="button" onClick={() => void close()} aria-label={closeLabel} className="flex h-11 w-11 items-center justify-center rounded-full bg-forest/8 text-forest"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
