import type { PickupStatus } from "@/lib/types";

const STYLES: Record<PickupStatus, string> = {
  on_the_way: "bg-cream-deep text-forest",
  arrived: "bg-gold/20 text-gold-deep",
  preparing: "bg-forest/10 text-forest",
  ready: "bg-forest text-paper",
  delivered: "bg-forest-deep text-paper",
  cancelled: "bg-danger/10 text-danger",
};

export function StatusBadge({
  status,
  label,
}: {
  status: PickupStatus;
  label: string;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {label}
    </span>
  );
}
