import type { PickupStatus } from "./types";

/**
 * Ciclo de una recogida: en camino → en la fila (llegó) → entregado.
 * El cierre (salida del plantel) vive en el viaje, no en el alumno.
 */
/** Tiempo que un alumno entregado sigue visible en "Notificados" (tablero) y "Entregados" (TV). */
export const DELIVERED_VISIBLE_MS = 5 * 60 * 1000;

const FORWARD: Partial<Record<PickupStatus, PickupStatus>> = {
  arrived: "delivered",
};

const BACK: Partial<Record<PickupStatus, PickupStatus>> = {
  delivered: "arrived",
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
  return status === "arrived";
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
): Partial<{ arrivedAt: string; deliveredAt: string }> {
  if (status === "arrived") return { arrivedAt: now };
  if (status === "delivered") return { deliveredAt: now };
  return {};
}
