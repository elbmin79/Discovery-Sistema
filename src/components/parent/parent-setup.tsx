"use client";

import { useMemo, useState } from "react";
import { Choice, Field } from "@/components/parent/picker-choice";
import { studentName } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ArrivalMethod, CreateTripInput, Guardian, Locale, Snapshot } from "@/lib/types";

export function ParentSetup({
  snapshot,
  guardian,
  selectedIds,
  locale,
  t,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  selectedIds: string[];
  locale: Locale;
  t: Dictionary;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (payload: Omit<CreateTripInput, "guardianId" | "studentIds">) => void;
}) {
  const selected = snapshot.students.filter((student) => selectedIds.includes(student.id));
  const authorized = snapshot.authorizedPeople.filter((person) =>
    person.studentIds.some((id) => selectedIds.includes(id)),
  );
  const vehicles = snapshot.vehicles.filter((vehicle) => vehicle.ownerGuardianId === guardian.id);

  const [pickerId, setPickerId] = useState(`self:${guardian.id}`);
  const [method, setMethod] = useState<ArrivalMethod>(guardian.defaultVehicleId ? "car" : "walk");
  const [vehicleId, setVehicleId] = useState(guardian.defaultVehicleId);
  const [guestName, setGuestName] = useState("");
  const [guestRelation, setGuestRelation] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const picker = useMemo(() => {
    if (pickerId === "guest") {
      return {
        pickerKind: "guest" as const,
        pickerName: guestName,
        pickerRelationEs: guestRelation || "Visita",
        pickerRelationEn: guestRelation || "Guest",
      };
    }
    if (pickerId === `self:${guardian.id}`) {
      return {
        pickerKind: "self" as const,
        pickerName: `${guardian.firstName} ${guardian.lastName}`,
        pickerRelationEs: guardian.relationEs,
        pickerRelationEn: guardian.relationEn,
      };
    }
    const person = authorized.find((item) => `auth:${item.id}` === pickerId);
    if (!person) {
      return {
        pickerKind: "self" as const,
        pickerName: `${guardian.firstName} ${guardian.lastName}`,
        pickerRelationEs: guardian.relationEs,
        pickerRelationEn: guardian.relationEn,
      };
    }
    return {
      pickerKind: "authorized" as const,
      pickerName: `${person.firstName} ${person.lastName}`,
      pickerRelationEs: person.relationEs,
      pickerRelationEn: person.relationEn,
    };
  }, [authorized, guestName, guestRelation, guardian, pickerId]);

  const canSubmit =
    picker.pickerKind !== "guest" || (guestName.trim().length > 1 && guestRelation.trim().length > 0);

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-sm font-medium text-forest">
        â† {t.back}
      </button>
      <div>
        <p className="text-sm text-muted">{t.pickupOf}</p>
        <h1 className="font-serif text-3xl text-forest">
          {selected.map((child) => child.firstName).join(" y ")}
        </h1>
        <p className="mt-1 text-sm text-muted">{selected.map(studentName).join(" Â· ")}</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">{t.whoPicks}</h2>
        <div className="mt-3 space-y-2">
          <Choice
            active={pickerId === `self:${guardian.id}`}
            title={`${t.me} Â· ${guardian.firstName}`}
            detail={locale === "es" ? guardian.relationEs : guardian.relationEn}
            onClick={() => setPickerId(`self:${guardian.id}`)}
          />
          {authorized.map((person) => (
            <Choice
              key={person.id}
              active={pickerId === `auth:${person.id}`}
              title={`${person.firstName} ${person.lastName}`}
              detail={`${t.authorized} Â· ${locale === "es" ? person.relationEs : person.relationEn}`}
              onClick={() => setPickerId(`auth:${person.id}`)}
            />
          ))}
          <Choice
            active={pickerId === "guest"}
            title={t.guest}
            detail={t.guestHint}
            onClick={() => setPickerId("guest")}
          />
        </div>
      </section>

      {pickerId === "guest" ? (
        <section className="space-y-2 rounded-3xl bg-paper p-4">
          <Field label={t.guestName} value={guestName} onChange={setGuestName} />
          <Field label={t.guestRelation} value={guestRelation} onChange={setGuestRelation} placeholder="TÃ­o, vecinaâ€¦" />
          <Field label={t.guestPhone} value={guestPhone} onChange={setGuestPhone} placeholder="686 123 4567" />
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-ink">{t.howArrive}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Choice active={method === "car"} title={t.byCar} onClick={() => setMethod("car")} />
          <Choice active={method === "walk"} title={t.walking} onClick={() => setMethod("walk")} />
        </div>
      </section>

      {method === "car" && vehicles.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-ink">{t.vehicle}</h2>
          <div className="mt-3 space-y-2">
            {vehicles.map((vehicle) => (
              <Choice
                key={vehicle.id}
                active={vehicleId === vehicle.id}
                title={vehicle.label}
                detail={vehicle.plate}
                onClick={() => setVehicleId(vehicle.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <button
        type="button"
        disabled={busy || !canSubmit}
        onClick={() =>
          onSubmit({
            ...picker,
            method,
            vehicleId: method === "car" ? vehicleId : undefined,
            guestPhone: pickerId === "guest" ? guestPhone : undefined,
          })
        }
        className="w-full rounded-full bg-forest py-4 text-lg font-semibold text-paper disabled:opacity-50"
      >
        {busy ? "â€¦" : t.sendNotice}
      </button>
    </div>
  );
}
