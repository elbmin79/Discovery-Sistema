"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function AnnouncementWindow({ children, origin, label, closeLabel, onClose }: {
  children: ReactNode;
  origin: { x: number; y: number; width: number; height: number };
  label: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const element = panel.current!;
    const previous = document.activeElement as HTMLElement | null;
    const box = element.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = element.animate([
      { transform: `translate(${origin.x - box.x}px, ${origin.y - box.y}px) scale(${origin.width / box.width}, ${origin.height / box.height})`, opacity: 0.25, borderRadius: "28px" },
      { transform: "translate(0, 0) scale(1)", opacity: 1, borderRadius: "0px" },
    ], { duration: reduced ? 0 : 480, easing: "cubic-bezier(.2,.8,.2,1)" });
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      animation.cancel();
      requestAnimationFrame(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); });
    };
  }, [origin]);

  async function close() {
    if (closing.current) return;
    closing.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await panel.current?.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.94) translateY(12px)" }], { duration: reduced ? 0 : 220, easing: "ease-in", fill: "forwards" }).finished.catch(() => undefined);
    onClose();
  }

  return (
    <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className="absolute inset-0 z-50 flex origin-top-left flex-col bg-cream" onKeyDown={(event) => {
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
