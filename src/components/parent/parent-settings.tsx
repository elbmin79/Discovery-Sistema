"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StudentAvatar } from "@/components/ui/avatar";
import { postJson } from "@/hooks/use-snapshot";
import { friendsOf, studentName } from "@/lib/school";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AuthorizedPerson, Guardian, Locale, Snapshot, Student, Vehicle } from "@/lib/types";

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

      <FriendsSection snapshot={snapshot} guardian={guardian} t={t} />

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

function FriendsSection({
  snapshot,
  guardian,
  t,
}: {
  snapshot: Snapshot;
  guardian: Guardian;
  t: Dictionary;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const friends = friendsOf(snapshot, guardian);

  async function add() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/account/friends", { guardianId: guardian.id, code });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-[0.14em] uppercase text-gold-deep">{t.friends}</h2>
      <p className="mt-1 text-sm text-muted">{t.friendsIntro}</p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-forest px-4 py-3 text-paper">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-gold">{t.yourCode}</p>
          <p className="mt-0.5 font-mono text-xl font-semibold tracking-wider">{guardian.friendCode}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(guardian.friendCode ?? "");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-forest-deep"
        >
          {copied ? t.codeCopied : t.copyCode}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex -space-x-2">
            {friends.slice(0, 4).map((friend) => {
              const kid = snapshot.students.find((student) => student.id === friend.studentIds[0]);
              return kid ? (
                <div key={friend.id} className="rounded-full ring-2 ring-paper">
                  <StudentAvatar student={kid} size="sm" />
                </div>
              ) : null;
            })}
          </div>
          <div className="min-w-0">
            <p className="font-medium">
              {t.friends} · {friends.length}
            </p>
            <p className="truncate text-sm text-muted">
              {friends.length === 0 ? t.noFriends : friends.map((friend) => friend.lastName).join(", ")}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`mt-2 space-y-2 ${open ? "" : "hidden"}`}>
        {friends.length === 0 ? (
          <p className="px-1 text-sm text-muted">{t.noFriends}</p>
        ) : (
          friends.map((friend) => {
            const kids = friend.studentIds
              .map((id) => snapshot.students.find((student) => student.id === id))
              .filter((student): student is Student => Boolean(student));
            return (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex -space-x-2">
                    {kids.slice(0, 3).map((kid) => (
                      <div key={kid.id} className="rounded-full ring-2 ring-paper">
                        <StudentAvatar student={kid} size="sm" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {friend.firstName} {friend.lastName}
                    </p>
                    <p className="truncate text-sm text-muted">{kids.map((kid) => kid.firstName).join(", ")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm text-danger"
                  onClick={() =>
                    postJson("/api/account/friends", { action: "remove", guardianId: guardian.id, friendId: friend.id })
                  }
                >
                  {t.remove}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className={`mt-3 gap-2 ${open ? "flex" : "hidden"}`}>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder={t.friendCodePlaceholder}
          className="min-w-0 flex-1 rounded-2xl border border-line px-3 py-2 font-mono text-sm uppercase"
        />
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={add}
          className="shrink-0 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {t.addFriend}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
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
              <p className="text-sm text-muted">
                {vehicle.plate ?? vehicle.color}
                {vehicle.tagId ? ` · ${t.tagLabel} ${vehicle.tagId}` : ""}
              </p>
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
