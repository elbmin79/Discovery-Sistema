"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PickupTrip } from "@/lib/types";

export function FullscreenQr({ qr, trip, t, onClose }: { qr: string; trip: PickupTrip; t: Dictionary; onClose: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      onClick={onClose}
      aria-label={t.closeQr}
      className="fixed inset-0 z-50 flex h-dvh w-screen flex-col items-center justify-center bg-forest-deep px-6 text-paper"
    >
      <p className="text-xs tracking-[0.22em] uppercase text-gold">{t.qrLabel}</p>
      {qr ? (
        <Image
          src={qr}
          alt={t.qrLabel}
          width={320}
          height={320}
          unoptimized
          className="mt-4 h-72 w-72 rounded-3xl bg-paper p-4"
        />
      ) : null}
      <p className="mt-8 text-xs tracking-[0.22em] uppercase text-gold">{t.codeLabel}</p>
      <p className="mt-3 font-serif text-6xl tracking-[0.22em]">{trip.code.split("").join(" ")}</p>
      <p className="mt-8 text-sm text-cream">{t.tapToClose}</p>
    </button>,
    document.body,
  );
}
