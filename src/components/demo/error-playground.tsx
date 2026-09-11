"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandRow } from "@/components/brand/brand-mark";
import {
  SYSTEM_STATUS_COPY,
  SystemStatus,
  type SystemStatusContext,
  type SystemStatusKind,
} from "@/components/ui/system-status";

const KINDS: SystemStatusKind[] = ["loading", "error", "stuck", "empty"];
const CONTEXTS: SystemStatusContext[] = [
  "familia",
  "personal",
  "admin",
  "kiosco",
  "pantalla",
  "pase",
  "general",
];

const KIND_LABEL: Record<SystemStatusKind, string> = {
  loading: "Carga",
  error: "Error",
  stuck: "Trabado",
  empty: "Vacío",
};

const CONTEXT_LABEL: Record<SystemStatusContext, string> = {
  familia: "Familia",
  personal: "Personal",
  admin: "Admin",
  kiosco: "Kiosco",
  pantalla: "Pantalla",
  pase: "Pase",
  general: "General",
};

export function ErrorPlayground() {
  const [kind, setKind] = useState<SystemStatusKind>("loading");
  const [context, setContext] = useState<SystemStatusContext>("familia");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const allMessages = useMemo(
    () =>
      CONTEXTS.flatMap((ctx) =>
        KINDS.flatMap((item) =>
          SYSTEM_STATUS_COPY[ctx][item].map((message) => ({
            context: ctx,
            kind: item,
            ...message,
          })),
        ),
      ),
    [],
  );

  const filtered = useMemo(
    () => allMessages.filter((item) => item.kind === kind && item.context === context),
    [allMessages, kind, context],
  );

  const deck = filtered.length > 0 ? filtered : allMessages;
  const safeIndex = carouselIndex % deck.length;
  const current = deck[safeIndex];

  useEffect(() => {
    if (paused || deck.length < 2) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((value) => (value + 1) % deck.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [paused, deck.length, kind, context]);

  function pickKind(next: SystemStatusKind) {
    setKind(next);
    setCarouselIndex(0);
  }

  function pickContext(next: SystemStatusContext) {
    setContext(next);
    setCarouselIndex(0);
  }

  return (
    <main className="min-h-dvh bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="rounded-lg">
            <BrandRow />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-forest">Vitrina de estados</h1>
            <p className="text-xs text-muted">Animación + mensajes de carga, error y fila trabada</p>
          </div>
        </div>
        <Link href="/" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest">
          Volver al hub
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-2 md:px-6">
        <section className="rounded-[1.75rem] border border-line bg-paper p-4 shadow-[0_12px_36px_color-mix(in_srgb,var(--forest)_6%,transparent)]">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => pickKind(item)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
                  kind === item ? "bg-forest text-paper" : "bg-cream text-muted"
                }`}
              >
                {KIND_LABEL[item]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONTEXTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => pickContext(item)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
                  context === item ? "bg-gold/30 text-forest" : "bg-cream text-muted"
                }`}
              >
                {CONTEXT_LABEL[item]}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-line/70 bg-cream/60">
            <SystemStatus
              kind={kind}
              context={context}
              onRetry={kind === "error" || kind === "stuck" ? () => setKind("loading") : undefined}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-line bg-paper p-4 shadow-[0_12px_36px_color-mix(in_srgb,var(--forest)_6%,transparent)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-forest">Carrusel de mensajes</h2>
              <p className="text-xs text-muted">
                {CONTEXT_LABEL[context]} · {KIND_LABEL[kind]} · {safeIndex + 1}/{deck.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="min-h-10 rounded-full border border-line px-3 text-sm font-semibold text-forest"
            >
              {paused ? "Play" : "Pausa"}
            </button>
          </div>

          <article className="mt-4 min-h-40 rounded-[1.5rem] border border-gold/40 bg-gold/10 px-5 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-deep">
              {CONTEXT_LABEL[current.context]} · {KIND_LABEL[current.kind]}
            </p>
            <h3 className="mt-3 font-serif text-3xl text-forest">{current.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted">{current.body}</p>
          </article>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setCarouselIndex((value) => (value - 1 + deck.length) % deck.length)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-forest"
            >
              ←
            </button>
            <div className="flex flex-wrap justify-center gap-1.5">
              {deck.map((item, index) => (
                <button
                  key={`${item.context}-${item.kind}-${item.title}-${index}`}
                  type="button"
                  aria-label={`Mensaje ${index + 1}`}
                  onClick={() => setCarouselIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full ${
                    index === safeIndex ? "bg-forest" : "bg-line"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => setCarouselIndex((value) => (value + 1) % deck.length)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-forest"
            >
              →
            </button>
          </div>

          <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1">
            {deck.map((item, index) => (
              <li key={`${item.title}-${index}`}>
                <button
                  type="button"
                  onClick={() => setCarouselIndex(index)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left ${
                    index === safeIndex ? "border-forest bg-forest/5" : "border-line bg-cream/50"
                  }`}
                >
                  <p className="text-sm font-semibold text-forest">{item.title}</p>
                  <p className="text-xs text-muted">{item.body}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
