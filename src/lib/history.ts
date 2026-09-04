import { jornadaOf, todayJornada, vehiclePhoto } from "./school";
import type { ArchivedLatePickup, HistoryPage, HistoryRow, HistorySummary, LatePickup, PickupTrip, Snapshot } from "./types";

export type HistoryStatusFilter = "all" | "delivered" | "active" | "cancelled";

export function matchesHistoryStatus(row: HistoryRow, status: HistoryStatusFilter) {
  return status === "all" || (status === "active" ? row.status !== "delivered" && row.status !== "cancelled" : row.status === status);
}

export function buildLateHistoryRow(snapshot: Snapshot, notice: LatePickup): ArchivedLatePickup {
  return { id: notice.id, jornada: jornadaOf(notice.createdAt), notice: structuredClone(notice),
    studentNames: snapshot.students.filter((student) => notice.studentIds.includes(student.id)).map((student) => `${student.firstName} ${student.lastName}`),
    events: structuredClone(snapshot.events.filter((event) => event.lateId === notice.id)) };
}

export function buildHistoryRow(snapshot: Snapshot, trip: PickupTrip, live = false): HistoryRow {
  const requests = snapshot.requests.filter((item) => item.tripId === trip.id);
  const students = snapshot.students.filter((item) => requests.some((request) => request.studentId === item.id));
  const vehicle = snapshot.vehicles.find((item) => item.id === trip.vehicleId);
  const deliveredAt = requests.map((item) => item.deliveredAt).filter((at): at is string => Boolean(at)).sort().at(-1);
  const status = requests.every((item) => item.status === "cancelled") ? "cancelled"
    : requests.every((item) => item.status === "cancelled" || item.status === "delivered") ? "delivered"
    : trip.arrivedAt ? "arrived" : "on_the_way";
  return {
    tripId: trip.id, jornada: jornadaOf(trip.arrivedAt ?? trip.createdAt), code: trip.code,
    guardianId: trip.guardianId, pickerName: trip.pickerName, pickerRelation: trip.pickerRelationEs,
    pickerKind: trip.pickerKind, method: trip.method, vehicleLabel: vehicle?.label,
    vehicleColor: vehicle?.color, plate: vehicle?.plate, tagId: vehicle?.tagId,
    vehiclePhoto: vehiclePhoto(vehicle), studentIds: students.map((item) => item.id),
    studentNames: students.map((item) => `${item.firstName} ${item.lastName}`),
    level: [...new Set(students.map((item) => item.level))].join(", "),
    zoneName: [...new Set(students.map((item) => snapshot.zones.find((zone) => zone.id === item.zoneId)?.nameEs).filter(Boolean))].join(", "),
    arrivalVia: trip.arrivalVia, departedVia: trip.departedVia, requestedAt: trip.createdAt,
    arrivedAt: trip.arrivedAt, deliveredAt, departedAt: trip.departedAt, cancelledAt: trip.cancelledAt,
    deliveredBy: [...new Set(requests.map((item) => item.deliveredByStaffName).filter(Boolean))].join(", "),
    status, waitMinutes: deliveredAt && trip.arrivedAt ? Math.max(0, Math.round((Date.parse(deliveredAt) - Date.parse(trip.arrivedAt)) / 60000)) : undefined,
    photoPath: trip.arrivalPhoto, live,
    detail: {
      requests: structuredClone(requests),
      events: structuredClone(snapshot.events.filter((item) => item.tripId === trip.id)),
      latePickups: structuredClone(snapshot.latePickups.filter((item) => jornadaOf(item.createdAt) === jornadaOf(trip.arrivedAt ?? trip.createdAt) && item.studentIds.some((id) => students.some((student) => student.id === id)))),
    },
  };
}

export function historySummary(rows: HistoryRow[]): HistorySummary {
  const waits = rows.flatMap((row) => row.waitMinutes === undefined ? [] : [row.waitMinutes]);
  return { total: rows.length, delivered: rows.filter((row) => row.status === "delivered").length,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
    averageWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : undefined };
}

export function validJornada(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function historyPage(allRows: HistoryRow[], from: string, to: string, limit: number, offset: number, latePickups: ArchivedLatePickup[] = []): HistoryPage {
  const unique = new Map(allRows.filter((row) => row.jornada >= from && row.jornada <= to).map((row) => [row.tripId, row]));
  const all = [...unique.values()].sort((a, b) => b.jornada.localeCompare(a.jornada) || (b.arrivedAt ?? b.requestedAt).localeCompare(a.arrivedAt ?? a.requestedAt) || a.tripId.localeCompare(b.tripId));
  const rows = all.slice(offset, offset + limit);
  return { from, to, includesToday: from <= todayJornada() && to >= todayJornada(), total: all.length,
    summary: historySummary(all), rows, latePickups,
    days: [...new Set([...rows.map((row) => row.jornada), ...latePickups.map((late) => late.jornada)])].sort().reverse().map((jornada) => ({ jornada,
      summary: historySummary(all.filter((row) => row.jornada === jornada)), rows: rows.filter((row) => row.jornada === jornada), latePickups: latePickups.filter((late) => late.jornada === jornada) })) };
}
