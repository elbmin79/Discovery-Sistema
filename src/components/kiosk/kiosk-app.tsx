"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Camera, Keyboard, QrCode } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { KioskScan } from "@/components/kiosk/kiosk-scan";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, useSnapshot } from "@/hooks/use-snapshot";
import { fallbackArrivalPhoto } from "@/lib/seed/demo-data";
import { findStudent, findVehicle, findZone, studentGrade, studentName } from "@/lib/school";
import type { PickupTrip, Snapshot, Student } from "@/lib/types";

type Step = "idle" | "scan" | "review" | "success";

export function KioskApp() {
  const { snapshot } = useSnapshot();
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeRef = useRef(code);
  const snapshotRef = useRef(snapshot);

  const trip = snapshot?.trips.find(
    (item) => !item.cancelledAt && (item.code === code || item.qrToken === code),
  );

  useEffect(() => {
    codeRef.current = code;
    snapshotRef.current = snapshot;
  }, [code, snapshot]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (step !== "idle") return;
    function onKey(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) {
        setError(null);
        setCode((current) => (current.length >= 4 ? current : current + event.key));
      }
      if (event.key === "Backspace") {
        setError(null);
        setCode((current) => current.slice(0, -1));
      }
      if (event.key === "Enter") {
        const currentCode = codeRef.current;
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot || currentCode.length !== 4) return;
        const found = currentSnapshot.trips.find((item) => item.code === currentCode && !item.cancelledAt);
        if (!found) {
          setError("No encontramos una solicitud con ese código.");
          return;
        }
        const open = currentSnapshot.requests.some(
          (request) =>
            request.tripId === found.id &&
            request.status !== "cancelled" &&
            request.status !== "delivered",
        );
        if (!open) {
          setError("Esa solicitud ya fue cerrada.");
          return;
        }
        setStep("review");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  useEffect(() => {
    if (step !== "review") return;
    let cancelled = false;

    async function openCamera() {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("No se detectó cámara. La llegada se registrará de todos modos.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraError(null);
      } catch {
        if (!cancelled) {
          setCameraError("No se pudo abrir la cámara. La llegada se registrará de todos modos.");
        }
      }
    }

    openCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step]);

  function takePhoto() {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext("2d");
      context?.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.8);
    }
    return fallbackArrivalPhoto(trip?.pickerName ?? "Llegada");
  }

  function typeDigit(digit: string) {
    setError(null);
    setCode((current) => (current.length >= 4 ? current : current + digit));
  }

  function lookup(nextCode = code) {
    if (!snapshot || !nextCode) return;
    const found = snapshot.trips.find(
      (item) => !item.cancelledAt && (item.code === nextCode || item.qrToken === nextCode),
    );
    if (!found) {
      setError("No encontramos una solicitud con ese código.");
      return;
    }
    setCode(found.code);
    const open = snapshot.requests.some(
      (request) =>
        request.tripId === found.id &&
        request.status !== "cancelled" &&
        request.status !== "delivered",
    );
    if (!open) {
      setError("Esa solicitud ya fue cerrada.");
      return;
    }
    setStep("review");
  }

  async function confirmArrival() {
    if (!trip) return;
    setBusy(true);
    try {
      const shot = takePhoto();
      await postJson("/api/trips/arrive", {
        code: trip.code,
        photo: shot,
      });
      stopCamera();
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    stopCamera();
    setCode("");
    setError(null);
    setCameraError(null);
    setStep("idle");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-forest-deep text-paper">
      <div className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="rounded-lg">
          <BrandMark size={56} light />
        </Link>
        <p className="text-sm text-gold">Kiosco de llegada</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-10">
        {step === "idle" ? (
          <IdlePanel
            code={code}
            error={error}
            onDigit={typeDigit}
            onClear={() => {
              setCode("");
              setError(null);
            }}
            onLookup={() => lookup()}
            onScan={() => {
              setError(null);
              setStep("scan");
            }}
          />
        ) : null}
        {step === "scan" ? (
          <KioskScan
            onFound={(value) => lookup(value)}
            onCancel={() => setStep("idle")}
          />
        ) : null}
        {step === "review" && snapshot && trip ? (
          <ReviewPanel
            snapshot={snapshot}
            trip={trip}
            cameraError={cameraError}
            videoRef={videoRef}
            busy={busy}
            error={error}
            onConfirm={confirmArrival}
            onBack={reset}
          />
        ) : null}
        {step === "success" && snapshot && trip ? (
          <SuccessPanel snapshot={snapshot} trip={trip} onDone={reset} />
        ) : null}
      </div>
    </main>
  );
}

function IdlePanel({
  code,
  error,
  onDigit,
  onClear,
  onLookup,
  onScan,
}: {
  code: string;
  error: string | null;
  onDigit: (digit: string) => void;
  onClear: () => void;
  onLookup: () => void;
  onScan: () => void;
}) {
  return (
    <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-2">
      <div>
        <p className="text-gold">Bienvenido a Discovery</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight">¿Vienes por un alumno?</h1>
        <p className="mt-4 max-w-md text-lg text-cream">
          Escanea el QR o ingresa el código de 4 dígitos del celular.
        </p>
        <button
          type="button"
          onClick={onScan}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 font-semibold text-forest-deep"
        >
          <QrCode className="h-5 w-5" />
          Escanear QR
        </button>
      </div>
      <div className="rounded-[2rem] bg-forest p-8">
        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <span
              key={index}
              className="flex h-16 w-14 items-center justify-center rounded-2xl bg-forest-deep font-serif text-4xl text-gold"
            >
              {code[index] ?? ""}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "C") onClear();
                else if (key === "OK") onLookup();
                else onDigit(key);
              }}
              className="rounded-2xl bg-forest-deep py-5 text-2xl font-semibold hover:bg-forest-soft"
            >
              {key === "C" ? "Borrar" : key === "OK" ? "Buscar" : key}
            </button>
          ))}
        </div>
        {error ? <p className="mt-4 text-center text-gold">{error}</p> : null}
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-cream">
          <Keyboard className="h-4 w-4" />
          También puedes usar el teclado
        </p>
      </div>
    </div>
  );
}

function ReviewPanel({
  snapshot,
  trip,
  cameraError,
  videoRef,
  busy,
  error,
  onConfirm,
  onBack,
}: {
  snapshot: Snapshot;
  trip: PickupTrip;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const requests = snapshot.requests.filter((request) => request.tripId === trip.id);
  const students = requests
    .map((request) => findStudent(snapshot, request.studentId))
    .filter((student): student is Student => Boolean(student));
  const vehicle = findVehicle(snapshot, trip.vehicleId);

  return (
    <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-2">
      <div className="rounded-[2rem] bg-forest p-8">
        <p className="text-gold">Solicitud {trip.code}</p>
        <h1 className="mt-2 font-serif text-4xl">
          {students.map((student) => student.firstName).join(" y ")}
        </h1>
        <div className="mt-6 space-y-4">
          {students.map((student) => {
            const zone = findZone(snapshot, student.zoneId);
            return (
              <div key={student.id} className="flex items-center gap-4 rounded-2xl bg-forest-deep p-4">
                <StudentAvatar student={student} size="lg" />
                <div>
                  <p className="text-xl font-semibold">{studentName(student)}</p>
                  <p className="text-cream">{studentGrade(student, "es")}</p>
                  <p className="text-sm text-gold">{zone?.nameEs}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 space-y-1 text-lg">
          <p>
            {trip.pickerRelationEs}: <strong>{trip.pickerName}</strong>
          </p>
          <p>{vehicle ? vehicle.label : "Llega caminando"}</p>
        </div>
      </div>

      <div className="rounded-[2rem] bg-paper p-8 text-ink">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
          <Camera className="h-4 w-4" />
          Al confirmar se toma la foto de llegada
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-cream-deep">
          <video ref={videoRef} muted playsInline className="h-64 w-full object-cover" />
        </div>
        {cameraError ? <p className="mt-3 text-sm text-muted">{cameraError}</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-full bg-forest py-4 text-xl font-semibold text-paper"
          >
            {busy ? "Registrando…" : "Confirmar llegada"}
          </button>
          <button type="button" onClick={onBack} className="py-2 text-sm text-muted">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({
  snapshot,
  trip,
  onDone,
}: {
  snapshot: Snapshot;
  trip: PickupTrip;
  onDone: () => void;
}) {
  const names = snapshot.requests
    .filter((request) => request.tripId === trip.id)
    .map((request) => findStudent(snapshot, request.studentId)?.firstName)
    .filter(Boolean)
    .join(" y ");

  return (
    <div className="max-w-2xl text-center">
      <p className="text-gold">Listo</p>
      <h1 className="mt-4 font-serif text-5xl">Ya avisamos al personal de la escuela.</h1>
      <p className="mt-4 text-xl text-cream">
        {trip.pickerName} quedó registrado para recoger a {names}.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-10 rounded-full bg-gold px-10 py-4 text-lg font-semibold text-forest-deep"
      >
        Nueva llegada
      </button>
    </div>
  );
}
