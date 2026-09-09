import { jornadaOf } from "./school";
import type { Guardian, Snapshot } from "./types";

export function lateEligibleStudentIds(snapshot: Snapshot, guardian: Guardian, jornada: string) {
  const approved = snapshot.requests.filter((request) =>
    request.authorization?.status === "approved" &&
    snapshot.trips.some((trip) => trip.id === request.tripId && trip.guardianId === guardian.id &&
      !trip.cancelledAt && jornadaOf(trip.createdAt) === jornada));
  return [...new Set([...guardian.studentIds, ...approved.map((request) => request.studentId)])];
}

export function lateReplacementTrips(snapshot: Snapshot, guardianId: string, studentIds: string[], jornada: string) {
  return snapshot.trips.filter((trip) => trip.guardianId === guardianId && !trip.cancelledAt &&
    jornadaOf(trip.createdAt) === jornada && snapshot.requests.some((request) =>
      request.tripId === trip.id && studentIds.includes(request.studentId) &&
      request.status !== "cancelled" && request.status !== "delivered"));
}
