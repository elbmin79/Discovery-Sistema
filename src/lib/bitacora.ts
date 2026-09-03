import { findStudent, findVehicle, findZone, LEVEL_LABELS } from "./school";
import type {
  ArrivalVia,
  DepartureVia,
  PickupEvent,
  PickupRequest,
  PickupStatus,
  Snapshot,
  Student,
} from "./types";

export interface BitacoraRow {
  requestId: string;
  tripId: string;
  student: Student;
  grade: string;
  zoneName: string;
  pickerName: string;
  pickerRelation: string;
  vehicleLabel: string;
  method: "car" | "walk";
  requestedAt: string;
  arrivedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  departedAt?: string;
  arrivalVia?: ArrivalVia;
  departedVia?: DepartureVia;
  cancelledAt?: string;
  status: PickupStatus;
  deliveredBy?: string;
  waitMinutes?: number;
}

export const ARRIVAL_LABELS: Record<ArrivalVia, string> = {
  tag: "Tag",
  qr: "QR",
  code: "Código",
};

export const DEPARTURE_LABELS: Record<DepartureVia, string> = {
  tag: "Lector de salida",
  parent: "Confirmó la familia",
  timeout: "Cierre automático",
};

export const STATUS_LABELS: Record<PickupStatus, string> = {
  on_the_way: "En camino",
  arrived: "Llegó",
  preparing: "Buscando",
  ready: "En puerta",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function buildBitacoraRows(snapshot: Snapshot): BitacoraRow[] {
  const rows: BitacoraRow[] = [];
  for (const request of snapshot.requests) {
    const student = findStudent(snapshot, request.studentId);
    if (!student) continue;
    const trip = snapshot.trips.find((item) => item.id === request.tripId);
    if (!trip) continue;
    const vehicle = findVehicle(snapshot, trip.vehicleId);
    const zone = findZone(snapshot, student.zoneId);

    rows.push({
      requestId: request.id,
      tripId: trip.id,
      student,
      grade: gradeLabel(student),
      zoneName: zone?.nameEs ?? "—",
      pickerName: trip.pickerName,
      pickerRelation: trip.pickerRelationEs,
      vehicleLabel: trip.method === "walk" ? "Caminando" : (vehicle?.label ?? "Auto"),
      method: trip.method,
      requestedAt: request.requestedAt,
      arrivedAt: request.arrivedAt,
      preparingAt: request.preparingAt,
      readyAt: request.readyAt,
      deliveredAt: request.deliveredAt,
      departedAt: request.status === "delivered" ? trip.departedAt : undefined,
      arrivalVia: trip.arrivalVia,
      departedVia: request.status === "delivered" ? trip.departedVia : undefined,
      cancelledAt: request.status === "cancelled" ? trip.cancelledAt : undefined,
      status: request.status,
      deliveredBy: request.deliveredByStaffName,
      waitMinutes:
        request.arrivedAt && request.deliveredAt
          ? Math.max(0, Math.round((Date.parse(request.deliveredAt) - Date.parse(request.arrivedAt)) / 60000))
          : undefined,
    });
  }

  return rows.sort((a, b) => {
    const timeA = a.arrivedAt ?? a.requestedAt;
    const timeB = b.arrivedAt ?? b.requestedAt;
    return timeB.localeCompare(timeA);
  });
}

export interface BitacoraSummary {
  total: number;
  delivered: number;
  cancelled: number;
  active: number;
  averageWait?: number;
}

export function buildSummary(rows: BitacoraRow[]): BitacoraSummary {
  const delivered = rows.filter((row) => row.status === "delivered").length;
  const cancelled = rows.filter((row) => row.status === "cancelled").length;
  const waits = rows.map((row) => row.waitMinutes).filter((value): value is number => value !== undefined);
  return {
    total: rows.length,
    delivered,
    cancelled,
    active: rows.length - delivered - cancelled,
    averageWait: waits.length > 0 ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : undefined,
  };
}

export function eventsForRequest(snapshot: Snapshot, request: PickupRequest): PickupEvent[] {
  const events = (snapshot.events ?? []).filter(
    (event) =>
      event.requestId === request.id ||
      ((event.type === "trip_created" || event.type === "arrived" || event.type === "departed") &&
        event.tripId === request.tripId),
  );
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export function eventLabel(event: PickupEvent): string {
  if (event.type === "trip_created") {
    return event.note ? `Recogida solicitada · ${event.note}` : "Recogida solicitada";
  }
  if (event.type === "arrived") {
    return event.note ? `Llegada confirmada · ${event.note}` : "Llegada confirmada en kiosco";
  }
  if (event.type === "delivered") return "Entregado";
  if (event.type === "cancelled") return "Solicitud cancelada";
  if (event.type === "authorization_requested") return event.note ?? "Se pidió confirmación a la familia";
  if (event.type === "authorization_changed") return event.note ?? "La familia respondió";
  if (event.type === "departed") return event.note ? `Ciclo cerrado · ${event.note}` : "Ciclo cerrado";
  if (event.fromStatus && event.toStatus) {
    return `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}`;
  }
  return "Cambio de estado";
}

export function actorLabel(event: PickupEvent): string {
  if (event.actorRole === "kiosk") return "Entrada";
  if (event.actorRole === "parent") return "Familia";
  return "Personal";
}

function gradeLabel(student: Student) {
  const level = LEVEL_LABELS[student.level].es;
  return student.group ? `${level} · ${student.group}` : level;
}

const CSV_HEADERS = [
  "Alumno",
  "Grupo",
  "Zona",
  "Quién recoge",
  "Parentesco",
  "Vehículo",
  "Solicitado",
  "Llegada",
  "Medio de llegada",
  "Buscando",
  "En puerta",
  "Entregado",
  "Salida",
  "Cierre",
  "Estado",
  "Entregó",
  "Espera (min)",
];

export function toCsv(rows: BitacoraRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        `${row.student.firstName} ${row.student.lastName}`,
        row.grade,
        row.zoneName,
        row.pickerName,
        row.pickerRelation,
        row.vehicleLabel,
        csvDateTime(row.requestedAt),
        csvDateTime(row.arrivedAt),
        row.arrivalVia ? ARRIVAL_LABELS[row.arrivalVia] : "",
        csvDateTime(row.preparingAt),
        csvDateTime(row.readyAt),
        csvDateTime(row.deliveredAt),
        csvDateTime(row.departedAt),
        row.departedVia ? DEPARTURE_LABELS[row.departedVia] : "",
        STATUS_LABELS[row.status],
        row.deliveredBy ?? "",
        row.waitMinutes !== undefined ? String(row.waitMinutes) : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvEscape(value: string) {
  if (/["\n,]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvDateTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function downloadCsv(csv: string) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bitacora-discovery-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
