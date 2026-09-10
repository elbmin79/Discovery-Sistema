import { jornadaOf } from "./school";
import type { Guardian, PickupTrip, Snapshot, Student } from "./types";

export function parentName(person?: Pick<Student, "firstName" | "lastName">) {
  return person ? `${person.firstName} ${person.lastName}`.trim() : "";
}

export function parentPickerName(snapshot: Snapshot, pickup: Pick<PickupTrip, "guardianId" | "pickerKind" | "pickerName">) {
  if (pickup.pickerKind === "guest") return pickup.pickerName;
  if (pickup.pickerKind === "self") {
    return parentName(snapshot.guardians.find((guardian) => guardian.id === pickup.guardianId)) || pickup.pickerName;
  }
  const person = [...snapshot.guardians, ...snapshot.authorizedPeople].find((person) =>
    parentName(person) === pickup.pickerName || `${person.lastName} ${person.firstName}` === pickup.pickerName);
  return parentName(person) || pickup.pickerName;
}

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
