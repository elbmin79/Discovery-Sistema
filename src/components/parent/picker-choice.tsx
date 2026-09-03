"use client";

export function Choice({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left ${
        active ? "border-forest bg-paper" : "border-line bg-paper/70"
      }`}
    >
      <p className="font-medium text-ink">{title}</p>
      {detail ? <p className="text-sm text-muted">{detail}</p> : null}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-line px-3 py-2 font-normal"
      />
    </label>
  );
}
