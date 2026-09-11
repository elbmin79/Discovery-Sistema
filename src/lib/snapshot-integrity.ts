import type { Snapshot } from "./types";

type Identified = { id: string };

const LEGACY_RENATA_ID = "s-renata";
const RENATA_CASTRO_ID = "s-renata-castro";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function guardianOwnsSurname(snapshot: Snapshot, guardianId: string, surname: string) {
  const guardian = snapshot.guardians.find((item) => item.id === guardianId);
  return Boolean(guardian && normalized(guardian.lastName).startsWith(normalized(surname)));
}

function legacyReferenceIsVazquez(snapshot: Snapshot, tripId?: string, guardianId?: string) {
  if (guardianId) return guardianOwnsSurname(snapshot, guardianId, "Vazquez");
  const trip = snapshot.trips.find((item) => item.id === tripId);
  return Boolean(trip && guardianOwnsSurname(snapshot, trip.guardianId, "Vazquez"));
}

function repairLegacyRenataCollision(snapshot: Snapshot) {
  const matches = snapshot.students.filter((student) => student.id === LEGACY_RENATA_ID);
  const castro = matches.filter((student) => normalized(student.lastName).startsWith("castro"));
  const vazquez = matches.filter((student) => normalized(student.lastName).startsWith("vazquez"));
  if (matches.length !== 2 || castro.length !== 1 || vazquez.length !== 1) return;
  const owners = snapshot.guardians.filter((guardian) => guardian.studentIds.includes(LEGACY_RENATA_ID));
  const unsafeOwner = owners.some((guardian) => !guardianOwnsSurname(snapshot, guardian.id, "Vazquez"));
  const unsafeRequest = snapshot.requests.some(
    (request) => request.studentId === LEGACY_RENATA_ID && !legacyReferenceIsVazquez(snapshot, request.tripId),
  );
  const unsafeLate = snapshot.latePickups.some(
    (late) => late.studentIds.includes(LEGACY_RENATA_ID) && !legacyReferenceIsVazquez(snapshot, undefined, late.guardianId),
  );
  const unsafeEvent = snapshot.events.some(
    (event) => event.studentId === LEGACY_RENATA_ID && !legacyReferenceIsVazquez(snapshot, event.tripId),
  );
  const unsafeAuthorized = snapshot.authorizedPeople.some((person) => person.studentIds.includes(LEGACY_RENATA_ID));
  if (unsafeOwner || unsafeRequest || unsafeLate || unsafeEvent || unsafeAuthorized) return;
  castro[0].id = RENATA_CASTRO_ID;
}

function assertUniqueIds(label: string, items: Identified[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  if (duplicates.size > 0) {
    throw new Error(`Datos inválidos: hay IDs duplicados de ${label} (${[...duplicates].join(", ")}).`);
  }
}

export function assertSnapshotIdentity(snapshot: Snapshot) {
  assertUniqueIds("zonas", snapshot.zones);
  assertUniqueIds("alumnos", snapshot.students);
  assertUniqueIds("familias", snapshot.guardians);
  assertUniqueIds("personas autorizadas", snapshot.authorizedPeople);
  assertUniqueIds("vehículos", snapshot.vehicles);
  assertUniqueIds("personal", snapshot.staff);
  assertUniqueIds("recogidas", snapshot.trips);
  assertUniqueIds("solicitudes", snapshot.requests);
  assertUniqueIds("pases", snapshot.guestPasses);
  assertUniqueIds("retrasos", snapshot.latePickups);
  assertUniqueIds("movimientos", snapshot.events);
  assertUniqueIds("avisos", snapshot.announcements);
  assertUniqueIds("eventos del calendario", snapshot.calendarEvents);

  const students = new Set(snapshot.students.map((student) => student.id));
  const ownerByStudent = new Map<string, string>();
  for (const guardian of snapshot.guardians) {
    const ownIds = new Set<string>();
    for (const studentId of guardian.studentIds) {
      if (ownIds.has(studentId)) {
        throw new Error(`Datos inválidos: el alumno ${studentId} está repetido en la familia ${guardian.id}.`);
      }
      if (!students.has(studentId)) {
        throw new Error(`Datos inválidos: la familia ${guardian.id} referencia al alumno inexistente ${studentId}.`);
      }
      const owner = ownerByStudent.get(studentId);
      if (owner && owner !== guardian.id) {
        throw new Error(`Datos inválidos: el alumno ${studentId} está asignado a más de una familia.`);
      }
      ownIds.add(studentId);
      ownerByStudent.set(studentId, guardian.id);
    }
  }

  for (const person of snapshot.authorizedPeople) {
    if (person.studentIds.some((studentId) => !students.has(studentId))) {
      throw new Error(`Datos inválidos: la persona autorizada ${person.id} referencia un alumno inexistente.`);
    }
  }
  for (const request of snapshot.requests) {
    if (!students.has(request.studentId)) {
      throw new Error(`Datos inválidos: la solicitud ${request.id} referencia un alumno inexistente.`);
    }
  }
  for (const late of snapshot.latePickups) {
    if (late.studentIds.some((studentId) => !students.has(studentId))) {
      throw new Error(`Datos inválidos: el retraso ${late.id} referencia un alumno inexistente.`);
    }
  }
  return snapshot;
}

export function normalizeSnapshotIdentity(snapshot: Snapshot) {
  repairLegacyRenataCollision(snapshot);
  return assertSnapshotIdentity(snapshot);
}
