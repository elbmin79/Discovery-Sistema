"use client";

import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { parsePickupPayload } from "@/lib/qr";

type Facing = "user" | "environment";

export function KioskScan({
  onFound,
  onCancel,
}: {
  onFound: (codeOrToken: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const foundRef = useRef(onFound);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");

  useEffect(() => {
    foundRef.current = onFound;
  }, [onFound]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("No hay cámara. Usa el código de 4 dígitos.");
        return;
      }
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("No se pudo abrir la cámara. Usa el código.");
        return;
      }

      const Detector = window.BarcodeDetector;
      if (!Detector) {
        setError("Este navegador no lee QR. Usa el código de 4 dígitos.");
        return;
      }

      const detector = new Detector({ formats: ["qr_code"] });
      timer = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (!raw) return;
          const parsed = parsePickupPayload(raw);
          if (parsed) {
            foundRef.current(parsed.code || parsed.token || raw);
          }
        } catch {
          // keep scanning
        }
      }, 400);
    }

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  return (
    <div className="w-full max-w-3xl rounded-[2rem] bg-forest p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Acerca el QR</h1>
          <p className="mt-2 text-cream">El celular del padre o el pase de visita.</p>
        </div>
        <button
          type="button"
          onClick={() => setFacing((current) => (current === "user" ? "environment" : "user"))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper/15 text-paper"
          aria-label={facing === "user" ? "Usar cámara trasera" : "Usar cámara frontal"}
        >
          <SwitchCamera className="h-6 w-6" />
        </button>
      </div>
      <video ref={videoRef} muted playsInline className="mt-6 h-80 w-full rounded-2xl object-cover" />
      {error ? <p className="mt-4 text-gold">{error}</p> : null}
      <button type="button" onClick={onCancel} className="mt-6 text-sm text-cream">
        Usar código
      </button>
    </div>
  );
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}
