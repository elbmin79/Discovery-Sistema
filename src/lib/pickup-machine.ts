import type { PickupStatus } from "./types";

const FORWARD: Partial<Record<PickupStatus, PickupStatus>> = {
  arrived: "preparing",
  preparing: "ready",
  ready: "delivered",
};

const BACK: Partial<Record<PickupStatus, PickupStatus>> = {
  preparing: "arrived",
  ready: "preparing",
  delivered: "ready",
};

export function canAdvance(status: PickupStatus) {
  return Boolean(FORWARD[status]);
}

export function canUndo(status: PickupStatus) {
  return Boolean(BACK[status]);
}

export function canCancel(status: PickupStatus) {
  return status === "on_the_way";
}

export function canComplete(status: PickupStatus) {
  return status === "preparing" || status === "ready";
}

export function nextStatus(status: PickupStatus) {
  return FORWARD[status];
}

export function previousStatus(status: PickupStatus) {
  return BACK[status];
}

export function applyStatusTimestamp(
  status: PickupStatus,
  now: string,
): Partial<{
  arrivedAt: string;
  preparingAt: string;
  readyAt: string;
  deliveredAt: string;
}> {
  if (status === "arrived") return { arrivedAt: now };
  if (status === "preparing") return { preparingAt: now };
  if (status === "ready") return { readyAt: now };
  if (status === "delivered") return { deliveredAt: now };
  return {};
}
