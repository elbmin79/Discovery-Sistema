"use client";

import { useState } from "react";
import { parentName } from "@/lib/parent-home";
import { StudentAvatar } from "@/components/ui/avatar";
import { canRemoveFromTrip } from "@/lib/pickup-machine";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PickupRequest, Snapshot, Student } from "@/lib/types";

export function RemoveFromPickupSheet({
  snapshot,
  requests,
  t,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  snapshot: Snapshot;
  requests: PickupRequest[];
  t: Dictionary;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (studentIds: string[], note?: string) => void;
}) {
  const removable = requests.filter((request) => canRemoveFromTrip(request.status));
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-pickup-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-paper p-5 shadow-xl"
      >
        <h2 id="remove-pickup-title" className="font-serif text-2xl text-forest">
          {t.removeFromPickupTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.removeFromPickupHint}</p>

        <div className="mt-4 space-y-2">
          {removable.map((request) => {
            const student = snapshot.students.find((item) => item.id === request.studentId);
            if (!student) return null;
            const active = selected.includes(student.id);
            return (
              <StudentToggle
                key={request.id}
                student={student}
                active={active}
                onToggle={() => toggle(student.id)}
              />
            );
          })}
        </div>

        <label className="mt-4 block text-sm font-medium text-ink">
          {t.removeNote}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t.removeNotePlaceholder}
            rows={2}
            className="mt-1 w-full rounded-2xl border border-line px-3 py-2 font-normal"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {selected.length === 0 ? <p className="mt-2 text-xs text-muted">{t.removeNeedOne}</p> : null}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => onConfirm(selected, note.trim() || undefined)}
            className="w-full rounded-full bg-forest py-3.5 text-base font-semibold text-paper disabled:opacity-50"
          >
            {busy ? "…" : t.removeConfirm}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full py-3 text-sm font-semibold text-muted"
          >
            {t.back}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentToggle({
  student,
  active,
  onToggle,
}: {
  student: Student;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
        active ? "border-danger/50 bg-danger/10" : "border-line bg-paper/70"
      }`}
    >
      <StudentAvatar student={student} size="sm" />
      <p className="min-w-0 flex-1 break-words font-medium text-ink">{parentName(student)}</p>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
          active ? "border-danger bg-danger text-paper" : "border-line"
        }`}
      >
        {active ? "−" : ""}
      </span>
    </button>
  );
}
