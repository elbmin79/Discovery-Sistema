"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { BrandMark } from "@/components/brand/brand-mark";
import { StudentAvatar } from "@/components/ui/avatar";
import { useSnapshot } from "@/hooks/use-snapshot";
import { pickupPayload } from "@/lib/qr";
import { findStudent, studentName } from "@/lib/school";

export function GuestPass({ token }: { token: string }) {
  const { snapshot } = useSnapshot();
  const [qr, setQr] = useState("");
  const [expanded, setExpanded] = useState(false);
  const trip = snapshot?.trips.find((item) => item.qrToken === token && !item.cancelledAt);

  useEffect(() => {
    if (!trip) return;
    QRCode.toDataURL(pickupPayload(trip.code, trip.qrToken), {
      margin: 1,
      width: 320,
      color: { dark: "#1B4D3E", light: "#FFFDF8" },
    }).then(setQr);
  }, [trip]);

  if (!snapshot) {
    return <p className="p-8 text-center text-muted">Cargando pase…</p>;
  }

  if (!trip) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <BrandMark />
        <h1 className="mt-8 font-serif text-3xl text-forest">Este pase no está activo</h1>
        <p className="mt-3 text-muted">Pide a la familia que genere uno nuevo desde la app.</p>
      </main>
    );
  }

  const students = snapshot.requests
    .filter((request) => request.tripId === trip.id)
    .map((request) => findStudent(snapshot, request.studentId))
    .filter(Boolean);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <BrandMark size={64} />
      <p className="mt-8 text-sm text-muted">Pase de visita</p>
      <h1 className="font-serif text-3xl text-forest">{trip.pickerName}</h1>
      <p className="text-muted">{trip.pickerRelationEs}</p>

      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-6 rounded-3xl bg-forest p-5 text-paper"
      >
        {qr ? (
          <Image src={qr} alt="QR de llegada" width={220} height={220} unoptimized className="mx-auto rounded-2xl bg-paper p-3" />
        ) : null}
        <p className="mt-4 text-center font-serif text-4xl tracking-[0.2em]">{trip.code.split("").join(" ")}</p>
        <p className="mt-2 text-center text-sm text-cream">Toca para ampliar · Muéstralo en el kiosco</p>
      </button>

      {expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-forest-deep px-6 text-paper"
        >
          {qr ? (
            <Image src={qr} alt="QR de llegada" width={320} height={320} unoptimized className="h-72 w-72 rounded-3xl bg-paper p-4" />
          ) : null}
          <p className="mt-8 font-serif text-6xl tracking-[0.22em]">{trip.code.split("").join(" ")}</p>
          <p className="mt-8 text-sm text-cream">Toca para cerrar</p>
        </button>
      ) : null}

      <div className="mt-6 space-y-3">
        {students.map((student) =>
          student ? (
            <div key={student.id} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3">
              <StudentAvatar student={student} />
              <p className="font-medium">{studentName(student)}</p>
            </div>
          ) : null,
        )}
      </div>
    </main>
  );
}
