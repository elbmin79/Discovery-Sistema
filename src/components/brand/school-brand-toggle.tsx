"use client";

import { useBrand } from "@/hooks/use-brand";
import type { SchoolBrandId } from "@/lib/types";

const OPTIONS: { id: SchoolBrandId; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "altius", label: "Altius" },
];

export function SchoolBrandToggle({ compact = false }: { compact?: boolean }) {
  const { brand, setBrand, busy } = useBrand();

  return (
    <div className={`flex flex-col ${compact ? "items-end gap-1" : "items-center gap-2"}`}>
      <p className={`font-semibold tracking-[0.14em] text-muted uppercase ${compact ? "text-[10px]" : "text-xs"}`}>
        Escuela
      </p>
      <div
        role="radiogroup"
        aria-label="Escuela"
        className="inline-flex rounded-full border border-line bg-paper p-1"
      >
        {OPTIONS.map((option) => {
          const active = brand === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => {
                if (!active) void setBrand(option.id);
              }}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
                active ? "bg-forest text-paper" : "text-forest"
              } disabled:opacity-60`}
            >
              {option.label}
              {option.id === "altius" ? (
                <span className={`ml-1 font-medium ${active ? "text-paper/80" : "text-muted"}`}>Secundaria</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
