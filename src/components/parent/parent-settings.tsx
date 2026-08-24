"use client";

import { useState } from "react";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson } from "@/hooks/use-snapshot";
import { studentName } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AuthorizedPerson, Guardian, Locale, Snapshot, Vehicle } from "@/lib/types";

type Editor = "none" | "vehicle" | "authorized";

export function ParentSettings({
  snapshot,
  guardian,
  locale,
  t,
  onLogout,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  locale: Locale;
  t: Dictionary;
  onLogout: () => void;
}) {
  const [editor, setEditor] = useState<Editor>("none");
  const children = snapshot.students.filter((student) => guardian.studentIds.includes(student.id));
  const vehicles = snapshot.vehicles.filter((vehicle) => vehicle.ownerGuardianId === guardian.id);
  const people = snapshot.authorizedPeople.filter((person) =>
    person.studentIds.some((id) => guardian.studentIds.includes(id)),
  );

  return (
    <div className="flex flex-col gap-8 pb-4">
      <div>
        <p className="text-sm text-muted">{t.settings}</p>
        <h1 className="font-serif text-3xl text-forest">
          {guardian.firstName} {guardian.lastName}
        </h1>
        <p className="mt-2 text-sm text-muted">{t.settingsIntro}</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold tracking-[0.14em] uppercase text-gold-deep">{t.children}</h2>
        <div className="mt-3 space-y-3">
          {children.map((child) => (
            <article key={child.id} className="flex items-center gap-4 rounded-3xl border border-line bg-paper p-4">
              <StudentAvatar student={child} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{studentName(child)}</p>
                <label className="mt-1 inline-block text-sm font-medium text-forest">
                  {t.editPhoto}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const photoUrl = await readFile(file);
                      await postJson("/api/account/photo", { studentId: child.id, photoUrl });
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <VehicleEditor
        guardian={guardian}
        vehicles={vehicles}
        t={t}
        open={editor === "vehicle"}
        onOpen={() => setEditor("vehicle")}
        onClose={() => setEditor("none")}
      />
      <AuthorizedEditor
        guardian={guardian}
        people={people}
        locale={locale}
        t={t}
        open={editor === "authorized"}
        onOpen={() => setEditor("authorized")}
        onClose={() => setEditor("none")}
      />

      <button type="button" onClick={onLogout} className="text-sm font-medium text-danger">
        {t.logout}
      </button>
    </div>
  );
}

function VehicleEditor({
  guardian,
  vehicles,
  t,
  open,
  onOpen,
  onClose,
}: {
  guardian: Guardian;
  vehicles: Vehicle[];
  t: Dictionary;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");

  async function save() {
    if (!label.trim()) return;
    await postJson("/api/account/vehicles", {
      ownerGuardianId: guardian.id,
      label: label.trim(),
      color: color.trim() || "—",
      plate: plate.trim() || undefined,
    });
    setLabel("");
    setColor("");
    setPlate("");
    onClose();
  }

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-[0.14em] uppercase text-gold-deep">{t.vehicles}</h2>
      <div className="mt-3 space-y-2">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
            <div>
              <p className="font-medium">{vehicle.label}</p>
              <p className="text-sm text-muted">{vehicle.plate ?? vehicle.color}</p>
            </div>
            <button
              type="button"
              className="text-sm text-danger"
              onClick={() => postJson("/api/account/vehicles", { action: "remove", id: vehicle.id })}
            >
              {t.remove}
            </button>
          </div>
        ))}
      </div>
      {open ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-paper p-4">
          <Field label={t.label} value={label} onChange={setLabel} />
          <Field label={t.color} value={color} onChange={setColor} />
          <Field label={t.plate} value={plate} onChange={setPlate} />
          <button type="button" onClick={save} className="w-full rounded-full bg-forest py-3 font-semibold text-paper">
            {t.save}
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-sm text-muted">
            {t.back}
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="mt-3 text-sm font-medium text-forest">
          + {t.addVehicle}
        </button>
      )}
    </section>
  );
}

function AuthorizedEditor({
  guardian,
  people,
  locale,
  t,
  open,
  onOpen,
  onClose,
}: {
  guardian: Guardian;
  people: AuthorizedPerson[];
  locale: Locale;
  t: Dictionary;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState("");

  async function save() {
    if (!firstName.trim() || !relation.trim()) return;
    await postJson("/api/account/authorized", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relationEs: relation.trim(),
      relationEn: relation.trim(),
      studentIds: guardian.studentIds,
    });
    setFirstName("");
    setLastName("");
    setRelation("");
    onClose();
  }

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-[0.14em] uppercase text-gold-deep">
        {t.authorizedPeople}
      </h2>
      <div className="mt-3 space-y-2">
        {people.map((person) => (
          <div key={person.id} className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
            <div>
              <p className="font-medium">
                {person.firstName} {person.lastName}
              </p>
              <p className="text-sm text-muted">{locale === "es" ? person.relationEs : person.relationEn}</p>
            </div>
            <button
              type="button"
              className="text-sm text-danger"
              onClick={() => postJson("/api/account/authorized", { action: "remove", id: person.id })}
            >
              {t.remove}
            </button>
          </div>
        ))}
      </div>
      {open ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-paper p-4">
          <Field label={t.name} value={firstName} onChange={setFirstName} />
          <Field label="Apellido" value={lastName} onChange={setLastName} />
          <Field label={t.relation} value={relation} onChange={setRelation} />
          <button type="button" onClick={save} className="w-full rounded-full bg-forest py-3 font-semibold text-paper">
            {t.save}
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-sm text-muted">
            {t.back}
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="mt-3 text-sm font-medium text-forest">
          + {t.addPerson}
        </button>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-line px-3 py-2"
      />
    </label>
  );
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
