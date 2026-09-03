"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Camera, Keyboard, QrCode, RadioTower } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { KioskScan } from "@/components/kiosk/kiosk-scan";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson, rememberSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { findStudent, findVehicle, findZone, formatTime, studentGrade, studentName } from "@/lib/school";
import type { Guardian, PickupTrip, Snapshot, Student, Vehicle } from "@/lib/types";

type Step = "idle" | "scan" | "review" | "auto" | "success";
type Mode = "code" | "tag";

interface TagTarget {
  vehicle: Vehicle;
  owner: Guardian;
  trip?: PickupTrip;
}

/** Llegada automática: la lee el lector de tag o la cámara de QR; la foto se toma sola. */
type AutoTarget = { kind: "tag"; target: TagTarget } | { kind: "qr"; trip: PickupTrip };

const TAG_READ_MS = 2200;

function hasOpenRequests(snapshot: Snapshot, tripId: string) {
  return snapshot.requests.some(
    (request) => request.tripId === tripId && request.status !== "cancelled" && request.status !== "delivered",
  );
}

function activeTripForVehicle(snapshot: Snapshot, vehicle: Vehicle) {
  return snapshot.trips.find(
    (trip) =>
      !trip.cancelledAt &&
      (trip.vehicleId === vehicle.id || (trip.guardianId === vehicle.ownerGuardianId && !trip.vehicleId)) &&
      hasOpenRequests(snapshot, trip.id),
  );
}

export function KioskApp() {
  const { snapshot } = useSnapshot();
  const [mode, setMode] = useState<Mode>("code");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heldTrip, setHeldTrip] = useState<PickupTrip | null>(null);
  const [autoTarget, setAutoTarget] = useState<AutoTarget | null>(null);
  const [autoPhase, setAutoPhase] = useState<"reading" | "photo" | "error">("reading");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeRef = useRef(code);
  const snapshotRef = useRef(snapshot);

  const liveTrip = snapshot?.trips.find(
    (item) => !item.cancelledAt && (item.code === code || item.qrToken === code),
  );
  const trip = liveTrip ?? heldTrip;

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
    if (step !== "idle" || mode !== "code") return;
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
        if (!hasOpenRequests(currentSnapshot, found.id)) {
          setError("Esa solicitud ya fue cerrada.");
          return;
        }
        setStep("review");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, mode]);

  useEffect(() => {
    if (step !== "review" && step !== "auto") return;
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

  // Lector de tag o cámara de QR: tras "leer", se toma la foto y se registra la llegada sin botones.
  useEffect(() => {
    if (step !== "auto" || !autoTarget) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setAutoPhase("photo");
      const shot = takePhoto();
      try {
        let arrived: PickupTrip | null = null;
        if (autoTarget.kind === "tag") {
          const { target } = autoTarget;
          const next = await postJson<Snapshot>("/api/trips/arrive-tag", {
            tagId: target.vehicle.tagId,
            photo: shot,
            createIfMissing: !target.trip,
          });
          arrived =
            next.trips.find(
              (item) =>
                !item.cancelledAt &&
                item.vehicleId === target.vehicle.id &&
                item.arrivalVia === "tag" &&
                hasOpenRequests(next, item.id),
            ) ?? null;
        } else {
          const next = await postJson<Snapshot>("/api/trips/arrive", {
            code: autoTarget.trip.code,
            photo: shot,
            via: "qr",
          });
          arrived = next.trips.find((item) => item.id === autoTarget.trip.id) ?? autoTarget.trip;
        }
        if (cancelled) return;
        stopCamera();
        setHeldTrip(arrived);
        setCode(arrived?.code ?? "");
        setStep("success");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo registrar la llegada.");
        setAutoPhase("error");
      }
    }, TAG_READ_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, autoTarget]);

  function takePhoto() {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const source = videoRef.current;
      const width = 640;
      const height = Math.round((source.videoHeight / source.videoWidth) * width);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context?.drawImage(source, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.55);
    }
    // Sin cámara: el servidor genera el dibujo de respaldo con el color del auto.
    return undefined;
  }

  function typeDigit(digit: string) {
    setError(null);
    setCode((current) => (current.length >= 4 ? current : current + digit));
  }

  async function lookup(nextCode = code, scanned = false) {
    if (!nextCode) return;
    let current = snapshot;
    if (!current) return;
    let found = current.trips.find(
      (item) => !item.cancelledAt && (item.code === nextCode || item.qrToken === nextCode),
    );
    if (!found) {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (response.ok) {
          current = (await response.json()) as Snapshot;
          rememberSnapshot(current);
          found = current.trips.find(
            (item) => !item.cancelledAt && (item.code === nextCode || item.qrToken === nextCode),
          );
        }
      } catch {
        // keep the local snapshot
      }
    }
    if (!found) {
      setError("No encontramos una solicitud con ese código.");
      return;
    }
    setCode(found.code);
    setHeldTrip(found);
    if (!hasOpenRequests(current, found.id)) {
      setError("Esa solicitud ya fue cerrada.");
      return;
    }
    if (scanned) {
      setAutoTarget({ kind: "qr", trip: found });
      setAutoPhase("reading");
      setStep("auto");
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
        via: heldTrip && heldTrip.qrToken === code ? "qr" : "code",
      });
      stopCamera();
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar.");
    } finally {
      setBusy(false);
    }
  }

  function startTag(target: TagTarget) {
    setError(null);
    setAutoTarget({ kind: "tag", target });
    setAutoPhase("reading");
    setStep("auto");
  }

  function reset() {
    stopCamera();
    setCode("");
    setHeldTrip(null);
    setAutoTarget(null);
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
            mode={mode}
            onMode={(next) => {
              setMode(next);
              setError(null);
            }}
            snapshot={snapshot}
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
            onTag={startTag}
          />
        ) : null}
        {step === "scan" ? (
          <KioskScan
            onFound={(value) => lookup(value, true)}
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
        {step === "auto" && snapshot && autoTarget ? (
          <AutoArrivePanel
            snapshot={snapshot}
            target={autoTarget}
            phase={autoPhase}
            error={error}
            cameraError={cameraError}
            videoRef={videoRef}
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
  mode,
  onMode,
  snapshot,
  code,
  error,
  onDigit,
  onClear,
  onLookup,
  onScan,
  onTag,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  snapshot: Snapshot | null;
  code: string;
  error: string | null;
  onDigit: (digit: string) => void;
  onClear: () => void;
  onLookup: () => void;
  onScan: () => void;
  onTag: (target: TagTarget) => void;
}) {
  return (
    <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-2">
      <div>
        <p className="text-gold">Bienvenido a Discovery</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight">¿Vienes por un alumno?</h1>
        <p className="mt-4 max-w-md text-lg text-cream">
          {mode === "code"
            ? "Visitas y personas autorizadas: escanea el QR o ingresa el código de 4 dígitos."
            : "Familias con tag en el auto: el lector de la entrada te reconoce al pasar y toma la foto."}
        </p>

        <div className="mt-6 inline-flex rounded-full bg-forest p-1">
          <ModeTab active={mode === "code"} onClick={() => onMode("code")} icon={<QrCode className="h-4 w-4" />}>
            QR o código
          </ModeTab>
          <ModeTab active={mode === "tag"} onClick={() => onMode("tag")} icon={<RadioTower className="h-4 w-4" />}>
            Tag del auto
          </ModeTab>
        </div>

        {mode === "code" ? (
          <button
            type="button"
            onClick={onScan}
            className="mt-6 flex items-center gap-2 rounded-full bg-gold px-5 py-3 font-semibold text-forest-deep"
          >
            <QrCode className="h-5 w-5" />
            Escanear QR
          </button>
        ) : (
          <p className="mt-6 max-w-md text-sm text-cream/70">
            Simulación del lector RFID: toca la familia que está pasando por la entrada.
          </p>
        )}
      </div>

      {mode === "code" ? (
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
      ) : (
        <TagPanel snapshot={snapshot} error={error} onTag={onTag} />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-gold text-forest-deep" : "text-cream hover:text-paper"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function TagPanel({
  snapshot,
  error,
  onTag,
}: {
  snapshot: Snapshot | null;
  error: string | null;
  onTag: (target: TagTarget) => void;
}) {
  const { announced, arrived, silent } = useMemo(() => {
    const announced: TagTarget[] = [];
    const arrived: TagTarget[] = [];
    const silent: TagTarget[] = [];
    if (!snapshot) return { announced, arrived, silent };
    for (const vehicle of snapshot.vehicles) {
      if (!vehicle.tagId) continue;
      const owner = snapshot.guardians.find((item) => item.id === vehicle.ownerGuardianId);
      if (!owner) continue;
      const trip = activeTripForVehicle(snapshot, vehicle);
      if (!trip) silent.push({ vehicle, owner });
      else if (trip.arrivedAt) arrived.push({ vehicle, owner, trip });
      else announced.push({ vehicle, owner, trip });
    }
    announced.sort((a, b) => (a.trip?.createdAt ?? "").localeCompare(b.trip?.createdAt ?? ""));
    return { announced, arrived, silent };
  }, [snapshot]);

  const kidsOf = (target: TagTarget) => {
    if (!snapshot) return "";
    const ids = target.trip
      ? snapshot.requests
          .filter((request) => request.tripId === target.trip!.id && request.status !== "cancelled")
          .map((request) => request.studentId)
      : target.owner.studentIds;
    return ids
      .map((id) => findStudent(snapshot, id)?.firstName)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-[2rem] bg-forest p-6">
      <p className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-gold">
        <RadioTower className="h-4 w-4" />
        Con solicitud activa · {announced.length}
      </p>
      <div className="mt-3 space-y-2">
        {announced.length === 0 ? (
          <p className="rounded-2xl bg-forest-deep/60 px-4 py-5 text-center text-sm text-cream/70">
            Ninguna familia con tag ha avisado todavía.
          </p>
        ) : (
          announced.map((target) => (
            <TagRow
              key={target.vehicle.id}
              target={target}
              kids={kidsOf(target)}
              meta={`Avisó ${formatTime(target.trip?.createdAt)}`}
              onClick={() => onTag(target)}
            />
          ))
        )}
      </div>

      {arrived.length > 0 ? (
        <>
          <p className="mt-6 text-xs tracking-[0.2em] uppercase text-cream/60">Ya en la fila · {arrived.length}</p>
          <div className="mt-3 space-y-2">
            {arrived.map((target) => (
              <TagRow
                key={target.vehicle.id}
                target={target}
                kids={kidsOf(target)}
                meta={`Llegó ${formatTime(target.trip?.arrivedAt)}`}
                muted
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-6 text-xs tracking-[0.2em] uppercase text-cream/60">Sin aviso · {silent.length}</p>
      <p className="mt-1 text-xs text-cream/60">
        Si pasan por el lector sin haber avisado, la solicitud se crea aquí mismo.
      </p>
      <div className="mt-3 space-y-2">
        {silent.map((target) => (
          <TagRow
            key={target.vehicle.id}
            target={target}
            kids={kidsOf(target)}
            meta="Llegó sin aviso"
            onClick={() => onTag(target)}
            dashed
          />
        ))}
      </div>

      {error ? <p className="mt-4 text-center text-gold">{error}</p> : null}
    </div>
  );
}

function TagRow({
  target,
  kids,
  meta,
  onClick,
  muted,
  dashed,
}: {
  target: TagTarget;
  kids: string;
  meta: string;
  onClick?: () => void;
  muted?: boolean;
  dashed?: boolean;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-xl leading-tight">Familia {target.owner.lastName}</p>
        <p className="truncate text-sm text-cream/80">
          {kids} · {target.vehicle.label}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm tracking-wider text-gold">{target.vehicle.tagId}</p>
        <p className="text-xs text-cream/70">{meta}</p>
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className={`flex items-center gap-4 rounded-2xl bg-forest-deep/50 px-4 py-3 ${muted ? "opacity-60" : ""}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${
        dashed
          ? "border border-dashed border-cream/30 bg-transparent hover:bg-forest-deep/60"
          : "bg-forest-deep hover:bg-forest-soft"
      }`}
    >
      {content}
    </button>
  );
}

function AutoArrivePanel({
  snapshot,
  target,
  phase,
  error,
  cameraError,
  videoRef,
  onBack,
}: {
  snapshot: Snapshot;
  target: AutoTarget;
  phase: "reading" | "photo" | "error";
  error: string | null;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onBack: () => void;
}) {
  const trip = target.kind === "qr" ? target.trip : target.target.trip;
  const ids = trip
    ? snapshot.requests
        .filter((request) => request.tripId === trip.id && request.status !== "cancelled")
        .map((request) => request.studentId)
    : target.kind === "tag"
      ? target.target.owner.studentIds
      : [];
  const students = ids
    .map((id) => findStudent(snapshot, id))
    .filter((student): student is Student => Boolean(student));
  const vehicle = target.kind === "tag" ? target.target.vehicle : findVehicle(snapshot, trip?.vehicleId);
  const title =
    target.kind === "tag"
      ? `Familia ${target.target.owner.lastName}`
      : students.map((student) => student.firstName).join(" y ");
  const subtitle =
    target.kind === "tag"
      ? vehicle?.label
      : `${trip?.pickerRelationEs}: ${trip?.pickerName}${vehicle ? ` · ${vehicle.label}` : ""}`;
  const heading =
    phase === "error"
      ? "No se pudo registrar"
      : target.kind === "tag"
        ? phase === "reading"
          ? "Leyendo tag"
          : "Tag reconocido"
        : phase === "reading"
          ? "QR reconocido"
          : "Llegada registrada";

  return (
    <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-2">
      <div className="rounded-[2rem] bg-forest p-8">
        <p className="flex items-center gap-2 text-gold">
          {target.kind === "tag" ? (
            <RadioTower className={`h-5 w-5 ${phase === "reading" ? "animate-pulse" : ""}`} />
          ) : (
            <QrCode className={`h-5 w-5 ${phase === "reading" ? "animate-pulse" : ""}`} />
          )}
          {heading}
          <span className="font-mono tracking-wider">{target.kind === "tag" ? vehicle?.tagId : trip?.code}</span>
        </p>
        <h1 className="mt-3 font-serif text-4xl">{title}</h1>
        <p className="mt-1 text-lg text-cream">{subtitle}</p>
        {target.kind === "tag" && !trip ? (
          <p className="mt-3 inline-block rounded-full border border-dashed border-gold/60 px-3 py-1 text-sm text-gold">
            Llegó sin aviso · se crea la solicitud
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          {students.map((student) => (
            <div key={student.id} className="flex items-center gap-4 rounded-2xl bg-forest-deep p-4">
              <StudentAvatar student={student} size="lg" />
              <div>
                <p className="text-xl font-semibold">{studentName(student)}</p>
                <p className="text-cream">{studentGrade(student, "es")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] bg-paper p-8 text-ink">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
          <Camera className="h-4 w-4" />
          {phase === "reading" ? "La cámara de la entrada toma la foto automáticamente" : "Foto de llegada tomada"}
        </p>
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-cream-deep">
          <video ref={videoRef} muted playsInline className="h-64 w-full object-cover" />
          {phase === "reading" ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-line">
              <div className="tv-progress h-full bg-gold" style={{ "--tv-rotate": `${TAG_READ_MS}ms` } as React.CSSProperties} />
            </div>
          ) : null}
        </div>
        {cameraError ? <p className="mt-3 text-sm text-muted">{cameraError}</p> : null}
        {phase === "error" ? (
          <>
            <p className="mt-3 text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper"
            >
              Volver
            </button>
          </>
        ) : (
          <button type="button" onClick={onBack} className="mt-6 w-full py-2 text-sm text-muted">
            Cancelar
          </button>
        )}
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
    .filter((request) => request.tripId === trip.id && request.status !== "cancelled")
    .map((request) => findStudent(snapshot, request.studentId)?.firstName)
    .filter(Boolean)
    .join(" y ");
  const vehicle = findVehicle(snapshot, trip.vehicleId);

  return (
    <div className="max-w-2xl text-center">
      <p className="text-gold">
        {trip.arrivalVia === "tag"
          ? `Tag ${vehicle?.tagId ?? ""} reconocido`
          : trip.arrivalVia === "qr"
            ? "QR reconocido · foto tomada"
            : "Listo"}
      </p>
      <h1 className="mt-4 font-serif text-5xl">Ya avisamos al personal de la escuela.</h1>
      <p className="mt-4 text-xl text-cream">
        {trip.pickerName} quedó registrado para recoger a {names}.
      </p>
      {trip.unannounced ? (
        <p className="mt-3 text-sm text-gold">La familia no había avisado; la solicitud se creó en la entrada.</p>
      ) : null}
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
