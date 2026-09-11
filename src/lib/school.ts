import type { Guardian, Level, Locale, PickupStatus, Snapshot, Student, Vehicle } from "./types";

export const SCHOOL = {
  name: "Discovery American Preschool & Academy",
  shortName: "Discovery",
  phone: "+52 686 837 8517",
  phoneHref: "tel:+526868378517",
  city: "Mexicali, B.C.",
  address: "Calzada CETYS & Del Sol Oeste, Residencial Veredas del Sol, 21259 Mexicali, B.C.",
} as const;

export const SCHOOL_TIMEZONE = "America/Tijuana";

export function jornadaOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayJornada(now = new Date()) {
  return jornadaOf(now.toISOString());
}

export function jornadaLabel(jornada: string) {
  const [year, month, day] = jornada.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  const label = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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

export function personName(person?: { firstName: string; lastName: string }) {
  return person ? `${person.firstName} ${person.lastName}`.trim() : "";
}

export function studentName(student?: Pick<Student, "firstName" | "lastName">) {
  if (!student) return "";
  return `${student.lastName} ${student.firstName}`.trim();
}

export function studentLastFirst(student: Student) {
  return `${student.lastName}, ${student.firstName}`;
}

export function studentGrade(student: Student, locale: Locale) {
  const level = LEVEL_LABELS[student.level][locale];
  return student.group ? `${level} · ${student.group}` : level;
}

export function dismissalMinutes(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*([ap])/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

export function byDismissalTime<T extends { dismissalTime: string }>(left: T, right: T) {
  return dismissalMinutes(left.dismissalTime) - dismissalMinutes(right.dismissalTime);
}

export function sortByDismissalTime<T extends { dismissalTime: string }>(items: T[]) {
  return [...items].sort(byDismissalTime);
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
  return result.sort((left, right) => byDismissalTime(left.student, right.student));
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

const STUDENT_PORTRAITS = {
  f: [
    "/students/s-sofia.png",
    "/students/s-regina.png",
    "/students/s-emilia.png",
    "/students/s-valentina.png",
    "/students/s-camila.png",
    "/students/s-renata.png",
    "/students/s-amanda.png",
    "/students/s-olivia.png",
    "/students/s-isabela.png",
    "/students/s-paula.png",
  ],
  m: [
    "/students/s-lucas.png",
    "/students/s-mateo.png",
    "/students/s-diego.png",
    "/students/s-santiago.png",
    "/students/s-joaquin.png",
    "/students/s-iker.png",
    "/students/s-leon.png",
    "/students/s-bruno.png",
    "/students/s-emiliano.png",
  ],
} as const;

const BUNDLED_STUDENT_PORTRAITS = new Set<string>([
  ...STUDENT_PORTRAITS.f,
  ...STUDENT_PORTRAITS.m,
]);

function stablePortraitIndex(studentId: string, portraitCount: number) {
  let hash = 0;
  for (const character of studentId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % portraitCount;
}

export function studentFallbackPhoto(student: Pick<Student, "id" | "gender">) {
  const dedicatedPortrait = `/students/${student.id}.png`;
  if (BUNDLED_STUDENT_PORTRAITS.has(dedicatedPortrait)) return dedicatedPortrait;
  const portraits = STUDENT_PORTRAITS[student.gender];
  return portraits[stablePortraitIndex(student.id, portraits.length)];
}

export function studentPhoto(student: Student) {
  return student.photoUrl ?? studentFallbackPhoto(student);
}

export function vehiclePhoto(vehicle?: Vehicle) {
  if (!vehicle) return undefined;
  return vehicle.photoUrl ?? `/cars/${vehicle.id}.png`;
}

/** Las fotos reales del kiosco son JPEG; los dibujos de respaldo son SVG generados. */
export function isCapturedPhoto(src?: string) {
  return Boolean(src) && !src!.startsWith("data:image/svg+xml") && !src!.startsWith("/cars/");
}

/** Las rutas de Supabase Storage se sirven por el endpoint firmado /api/photos. */
export function resolvePhotoSrc(photoPath?: string) {
  if (!photoPath) return undefined;
  if (photoPath.startsWith("data:") || photoPath.startsWith("/") || photoPath.startsWith("http")) {
    return photoPath;
  }
  return `/api/photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
}

export function arrivalPictureFromSources(arrivalPhoto?: string, registeredPhoto?: string) {
  const captured = isCapturedPhoto(arrivalPhoto);
  if (arrivalPhoto) {
    return {
      src: resolvePhotoSrc(arrivalPhoto),
      captured,
      fallback: registeredPhoto,
    };
  }
  return { src: registeredPhoto, captured: false, fallback: undefined };
}

/**
 * Foto que debe ver el personal: primero la captura real de la llegada,
 * luego el dibujo de respaldo del kiosco y al final la foto del vehículo registrado.
 */
export function arrivalPicture(trip: { arrivalPhoto?: string }, vehicle?: Vehicle) {
  return arrivalPictureFromSources(trip.arrivalPhoto, vehiclePhoto(vehicle));
}
