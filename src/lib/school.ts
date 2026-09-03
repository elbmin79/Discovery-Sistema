import type { Guardian, Level, Locale, PickupStatus, Snapshot, Student, Vehicle } from "./types";

export const SCHOOL = {
  name: "Discovery American Preschool & Academy",
  shortName: "Discovery",
  city: "Mexicali, B.C.",
  address: "Calzada CETYS & Del Sol Oeste, Residencial Veredas del Sol, 21259 Mexicali, B.C.",
} as const;

export const LEVEL_LABELS: Record<Level, { es: string; en: string; stage: "preschool" | "elementary" }> = {
  "toddlers-b": { es: "Toddlers B", en: "Toddlers B", stage: "preschool" },
  "toddlers-a": { es: "Toddlers A", en: "Toddlers A", stage: "preschool" },
  primary: { es: "Primary", en: "Primary", stage: "preschool" },
  "pre-kinder": { es: "Pre Kinder", en: "Pre Kinder", stage: "preschool" },
  kindergarten: { es: "Kindergarten", en: "Kindergarten", stage: "preschool" },
  "grade-1": { es: "1° Primaria", en: "1st Grade", stage: "elementary" },
  "grade-2": { es: "2° Primaria", en: "2nd Grade", stage: "elementary" },
  "grade-3": { es: "3° Primaria", en: "3rd Grade", stage: "elementary" },
  "grade-4": { es: "4° Primaria", en: "4th Grade", stage: "elementary" },
  "grade-5": { es: "5° Primaria", en: "5th Grade", stage: "elementary" },
  "grade-6": { es: "6° Primaria", en: "6th Grade", stage: "elementary" },
};

export const STATUS_ORDER: PickupStatus[] = ["on_the_way", "arrived", "delivered"];

export function studentName(student: Student) {
  return `${student.firstName} ${student.lastName}`;
}

export function studentGrade(student: Student, locale: Locale) {
  const level = LEVEL_LABELS[student.level][locale];
  return student.group ? `${level} · ${student.group}` : level;
}

export function findStudent(snapshot: Snapshot, id: string) {
  return snapshot.students.find((student) => student.id === id);
}

export function findGuardian(snapshot: Snapshot, id: string) {
  return snapshot.guardians.find((guardian) => guardian.id === id);
}

export function findVehicle(snapshot: Snapshot, id?: string) {
  if (!id) return undefined;
  return snapshot.vehicles.find((vehicle) => vehicle.id === id);
}

export function findZone(snapshot: Snapshot, id: string) {
  return snapshot.zones.find((zone) => zone.id === id);
}

export function tripRequests(snapshot: Snapshot, tripId: string) {
  return snapshot.requests.filter((request) => request.tripId === tripId);
}

export function friendsOf(snapshot: Snapshot, guardian: Guardian) {
  const ids = new Set(guardian.friendIds ?? []);
  return snapshot.guardians.filter((item) => ids.has(item.id));
}

/** Hijos de las familias amigas, con su tutor, para poder pedirlos desde la app. */
export function friendKids(snapshot: Snapshot, guardian: Guardian) {
  const result: Array<{ student: Student; owner: Guardian }> = [];
  for (const owner of friendsOf(snapshot, guardian)) {
    for (const studentId of owner.studentIds) {
      const student = findStudent(snapshot, studentId);
      if (student && !guardian.studentIds.includes(student.id)) result.push({ student, owner });
    }
  }
  return result;
}

/** Solicitudes de amigos sobre los hijos de este tutor que siguen abiertas. */
export function authorizationsFor(snapshot: Snapshot, guardianId: string) {
  return snapshot.requests.filter(
    (request) =>
      request.authorization?.ownerGuardianId === guardianId &&
      request.status !== "delivered" &&
      request.status !== "cancelled",
  );
}

export function activeRequests(snapshot: Snapshot) {
  return snapshot.requests.filter(
    (request) => request.status !== "delivered" && request.status !== "cancelled",
  );
}

export function greeting(locale: Locale, date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return locale === "es" ? "Buenos días" : "Good morning";
  if (hour < 19) return locale === "es" ? "Buenas tardes" : "Good afternoon";
  return locale === "es" ? "Buenas noches" : "Good evening";
}

export function formatTime(iso?: string, locale: Locale = "es") {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(locale === "es" ? "es-MX" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function studentPhoto(student: Student) {
  return student.photoUrl ?? `/students/${student.id}.png`;
}

export function vehiclePhoto(vehicle?: Vehicle) {
  if (!vehicle) return undefined;
  return vehicle.photoUrl ?? `/cars/${vehicle.id}.png`;
}

/** Las fotos reales del kiosco son JPEG; los dibujos de respaldo son SVG generados. */
export function isCapturedPhoto(src?: string) {
  return Boolean(src) && !src!.startsWith("data:image/svg+xml");
}

/**
 * Foto que debe ver el personal: primero la captura real de la llegada,
 * luego la foto genérica del vehículo y al final el dibujo de respaldo.
 */
export function arrivalPicture(trip: { arrivalPhoto?: string }, vehicle?: Vehicle) {
  if (isCapturedPhoto(trip.arrivalPhoto)) {
    return { src: trip.arrivalPhoto!, captured: true, fallback: vehiclePhoto(vehicle) };
  }
  return { src: vehiclePhoto(vehicle), captured: false, fallback: trip.arrivalPhoto };
}
