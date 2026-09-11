import { jornadaOf, personName } from "./school";
import type { Guardian, PickupTrip, Snapshot, Student } from "./types";

export function parentName(person?: Pick<Student, "firstName" | "lastName">) {
  return personName(person);
}

function matchesPersonName(person: Pick<Student, "firstName" | "lastName">, value: string) {
  return personName(person) === value || `${person.lastName} ${person.firstName}`.trim() === value;
}

export function parentPickerName(snapshot: Snapshot, pickup: Pick<PickupTrip, "guardianId" | "pickerKind" | "pickerName">) {
  if (pickup.pickerKind === "guest") return pickup.pickerName;
  if (pickup.pickerKind === "self") {
    return parentName(snapshot.guardians.find((guardian) => guardian.id === pickup.guardianId)) || pickup.pickerName;
  }
  const person = [...snapshot.guardians, ...snapshot.authorizedPeople].find((person) =>
    matchesPersonName(person, pickup.pickerName));
  return parentName(person) || pickup.pickerName;
}

export function normalizeParentNames(snapshot: Snapshot) {
  const people = [...snapshot.guardians, ...snapshot.authorizedPeople];
  const resolve = (value: string, guardianId?: string) => {
    const guardian = guardianId
      ? snapshot.guardians.find((person) => person.id === guardianId && matchesPersonName(person, value))
      : undefined;
    const person = guardian ?? people.find((candidate) => matchesPersonName(candidate, value));
    return person ? personName(person) : value;
  };

  for (const trip of snapshot.trips) {
    if (trip.pickerKind !== "guest") trip.pickerName = resolve(trip.pickerName, trip.guardianId);
  }
  for (const late of snapshot.latePickups) {
    if (late.pickerKind !== "guest") late.pickerName = resolve(late.pickerName, late.guardianId);
  }
  for (const event of snapshot.events) {
    if (event.actorName && event.actorRole === "parent") event.actorName = resolve(event.actorName);
  }
  return snapshot;
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
