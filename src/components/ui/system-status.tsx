"use client";

import { useEffect, useState } from "react";

export type SystemStatusKind = "loading" | "error" | "stuck" | "empty";
export type SystemStatusContext =
  | "familia"
  | "personal"
  | "admin"
  | "kiosco"
  | "pantalla"
  | "pase"
  | "general";

export const SYSTEM_STATUS_COPY: Record<
  SystemStatusContext,
  Record<SystemStatusKind, { title: string; body: string }[]>
> = {
  familia: {
    loading: [
      { title: "Preparando tu pase…", body: "Como cada tarde en la fila de Discovery." },
      { title: "Acomodando la salida…", body: "Ya casi tienes listo el plan de hoy." },
      { title: "Un momento…", body: "Estamos sincronizando con la escuela." },
    ],
    error: [
      { title: "Se nos trabó la fila", body: "No pudimos hablar con la escuela. Intenta de nuevo." },
      { title: "Señal a medias", body: "Tu pase sigue seguro; solo falta reconectar." },
    ],
    stuck: [
      { title: "La fila va más lenta", body: "Sigue esperando un segundo o reintenta la conexión." },
      { title: "Todavía acomodamos autos", body: "Si tarda mucho, toca reintentar." },
    ],
    empty: [
      { title: "Sin recogida por ahora", body: "Cuando armes el plan de hoy, aparece aquí." },
    ],
  },
  personal: {
    loading: [
      { title: "Armando el tablero…", body: "Preparando las familias en la fila." },
      { title: "Sincronizando salida…", body: "Un toque y listo, como siempre." },
    ],
    error: [
      { title: "El tablero no responde", body: "Revisa la conexión e intenta otra vez." },
    ],
    stuck: [
      { title: "La fila se detuvo un momento", body: "Espera o reintenta para ver llegadas nuevas." },
    ],
    empty: [
      { title: "Nadie en la fila", body: "Cuando lleguen papás, aparecen aquí." },
    ],
  },
  admin: {
    loading: [
      { title: "Abriendo el panel…", body: "Revisando la jornada de salida." },
      { title: "Cargando recogidas…", body: "Historial y avisos en camino." },
    ],
    error: [
      { title: "No pudimos cargar el panel", body: "La oficina necesita la conexión de vuelta." },
    ],
    stuck: [
      { title: "El panel tarda más de lo normal", body: "Puedes reintentar sin perder el filtro." },
    ],
    empty: [
      { title: "Sin recogidas en este rango", body: "Prueba otro día o limpia los filtros." },
    ],
  },
  kiosco: {
    loading: [
      { title: "Despertando la entrada…", body: "Lista para leer tags y códigos." },
      { title: "Preparando el kiosco…", body: "La fila de carpool no se detiene." },
    ],
    error: [
      { title: "La entrada no conecta", body: "Revisa la red antes de registrar llegadas." },
    ],
    stuck: [
      { title: "El kiosco está pensando…", body: "Si se queda así, reintenta la conexión." },
    ],
    empty: [{ title: "Listo para escanear", body: "Espera el siguiente auto." }],
  },
  pantalla: {
    loading: [
      { title: "Encendiendo la pantalla…", body: "Pronto verás a los siguientes en la fila." },
    ],
    error: [
      { title: "Pantalla sin señal", body: "Reconecta para mostrar la salida en vivo." },
    ],
    stuck: [
      { title: "Esperando actualización…", body: "La fila se refresca sola en unos segundos." },
    ],
    empty: [
      { title: "Esperando familias", body: "Cuando alguien llegue, sale en grande." },
    ],
  },
  pase: {
    loading: [
      { title: "Abriendo tu pase…", body: "Un segundo para mostrar el código." },
    ],
    error: [
      { title: "No encontramos el pase", body: "Pide a la familia que genere uno nuevo." },
    ],
    stuck: [
      { title: "El pase tarda en cargar", body: "Reintenta si la pantalla se queda en blanco." },
    ],
    empty: [
      { title: "Este pase no está activo", body: "Pide a la familia que genere uno nuevo desde la app." },
    ],
  },
  general: {
    loading: [
      { title: "Cargando…", body: "Preparando la salida escolar." },
      { title: "Un momento…", body: "Como en la fila de Discovery." },
    ],
    error: [
      { title: "Algo se trabó", body: "Intenta de nuevo en un momento." },
    ],
    stuck: [
      { title: "Esto está tardando", body: "Puedes esperar o reintentar." },
    ],
    empty: [
      { title: "Nada por aquí", body: "Vuelve cuando haya movimiento en la salida." },
    ],
  },
};

export function SystemStatus({
  kind,
  context = "general",
  title,
  body,
  detail,
  onRetry,
  retryLabel = "Reintentar",
  compact = false,
  className = "",
}: {
  kind: SystemStatusKind;
  context?: SystemStatusContext;
  title?: string;
  body?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const pool = SYSTEM_STATUS_COPY[context][kind];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pool.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % pool.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  const message = pool[index] ?? pool[0];
  const heading = title ?? message.title;
  const subtitle = body ?? message.body;

  return (
    <div
      role={kind === "error" || kind === "stuck" ? "alert" : "status"}
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-3 px-4 py-6" : "min-h-[50dvh] gap-5 px-6 py-10"
      } ${className}`}
    >
      <StatusScene kind={kind} compact={compact} />
      {(kind === "loading" || kind === "stuck") && (
        <div
          className={`status-spinner ${kind === "stuck" ? "status-spinner-stuck" : ""} ${
            compact ? "h-8 w-8" : "h-11 w-11"
          }`}
          aria-hidden
        />
      )}
      <div className="max-w-sm">
        <h2 className={`font-serif text-forest ${compact ? "text-xl" : "text-3xl"}`}>{heading}</h2>
        <p className={`mt-2 text-muted ${compact ? "text-sm" : "text-base leading-relaxed"}`}>{subtitle}</p>
        {detail ? <p className="mt-2 text-xs text-muted/80">{detail}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-full bg-forest px-5 text-sm font-semibold text-paper"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function StatusScene({ kind, compact }: { kind: SystemStatusKind; compact: boolean }) {
  const size = compact ? "h-24 w-44" : "h-36 w-64";
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-[0_12px_36px_rgb(18_56_45/0.08)] ${size}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(196_161_90/0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgb(27_77_62/0.12),transparent_40%)]" />
      <svg viewBox="0 0 260 140" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="0" y="98" width="260" height="42" fill="#E8DFD0" />
        <path d="M0 98 H260" stroke="#D9CFC0" strokeWidth="2" />
        <rect x="18" y="42" width="72" height="56" rx="6" fill="#1B4D3E" />
        <polygon points="14,42 54,18 94,42" fill="#12382D" />
        <rect x="30" y="58" width="14" height="14" rx="2" fill="#C4A15A" className={kind === "loading" ? "status-window" : undefined} />
        <rect x="52" y="58" width="14" height="14" rx="2" fill="#C4A15A" className={kind === "loading" ? "status-window status-window-delay" : undefined} />
        <rect x="40" y="78" width="16" height="20" rx="2" fill="#F6F1E8" />
        <circle cx="210" cy="34" r="12" fill="#C4A15A" opacity="0.55" className={kind === "stuck" ? "status-sun-stuck" : "status-sun"} />
        {kind === "error" || kind === "stuck" ? (
          <g className="status-cone">
            <polygon points="128,96 118,72 138,72" fill="#8F3A32" />
            <rect x="116" y="96" width="24" height="4" rx="1" fill="#8F3A32" />
            <rect x="121" y="80" width="14" height="4" fill="#FFFDF8" />
          </g>
        ) : null}
        <g className={kind === "loading" ? "status-lane" : kind === "stuck" ? "status-lane-stuck" : "status-lane-error"}>
          <CarSvg x={kind === "empty" ? 150 : 40} y={100} />
          {kind !== "empty" ? <CarSvg x={120} y={100} tint="#2D6B56" /> : null}
          {kind === "loading" ? <CarSvg x={200} y={100} tint="#A4843D" /> : null}
        </g>
        {kind === "loading" ? (
          <g className="status-kids">
            <circle cx="168" cy="88" r="4.5" fill="#1B4D3E" />
            <rect x="165" y="92" width="6" height="8" rx="2" fill="#C4A15A" />
            <circle cx="182" cy="88" r="4.5" fill="#1B4D3E" />
            <rect x="179" y="92" width="6" height="8" rx="2" fill="#2D6B56" />
          </g>
        ) : null}
      </svg>
      {kind === "loading" ? (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          <span className="status-dot" />
          <span className="status-dot status-dot-delay" />
          <span className="status-dot status-dot-delay-2" />
        </div>
      ) : null}
    </div>
  );
}

function CarSvg({ x, y, tint = "#1B4D3E" }: { x: number; y: number; tint?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="36" height="14" rx="4" fill={tint} />
      <rect x="8" y="-8" width="18" height="10" rx="3" fill={tint} opacity="0.85" />
      <circle cx="10" cy="14" r="3.5" fill="#1C241F" />
      <circle cx="26" cy="14" r="3.5" fill="#1C241F" />
      <rect x="11" y="-5" width="5" height="5" rx="1" fill="#F6F1E8" />
      <rect x="18" y="-5" width="5" height="5" rx="1" fill="#F6F1E8" />
    </g>
  );
}

export function useSlowLoading(active: boolean, delayMs = 8000) {
  const [state, setState] = useState({ active: false, slow: false });

  if (state.active !== active) {
    setState({ active, slow: false });
  }

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setState((current) => (current.active ? { active: true, slow: true } : current));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return state.active && state.slow;
}
