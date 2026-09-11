import { hydrateStudentSurnames } from "../student-surnames";
import {
  applyStatusTimestamp,
  canAdvance,
  canCancel,
  canComplete,
  canRemoveFromTrip,
  canUndo,
  nextStatus,
  previousStatus,
} from "../pickup-machine";
import { createSeedSnapshot, fallbackArrivalPhoto } from "../seed/demo-data";
import { buildHistoryRow, buildLateHistoryRow } from "../history";
import type { ArchivedLatePickup, HistoryRow } from "../types";
import { lateEligibleStudentIds, lateReplacementTrips } from "../parent-home";
import { jornadaOf, todayJornada } from "../school";
import { isCalendarEventColor } from "../school-comms";
import type {
  ArrivalMethod,
  ArrivalVia,
  ArriveByTagInput,
  ArriveTripInput,
  AuthorizationStatus,
  AuthorizedPerson,
  CreateLatePickupInput,
  CreateTripInput,
  DepartureVia,
  Guardian,
  Level,
  PickupEvent,
  PickupStatus,
  PickupTrip,
  PushSubscriptionRecord,
  Snapshot,
  UpdateTripInput,
  Vehicle,
} from "../types";

type Listener = (snapshot: Snapshot) => void;
type PickupRequestRef = Snapshot["requests"][number];

const MAX_EVENTS = 800;
export const AUTO_CLOSE_MS = 30 * 60 * 1000;
const SIM_WAITING_CAP = 8;
const SIM_MIN_MS = 7_000;
const SIM_MAX_MS = 10_000;

const SIM_FIRST_NAMES_F = ["Camila", "Valeria", "Renata", "Paulina", "Ximena", "Daniela", "Regina", "Natalia", "Fernanda", "Andrea"];
const SIM_FIRST_NAMES_M = ["Emiliano", "Santiago", "Diego", "Mateo", "Sebastián", "Leonardo", "Gael", "Iván", "Adrián", "Joaquín"];
const SIM_LAST_NAMES = ["Herrera", "Castillo", "Navarro", "Rangel", "Pineda", "Quiroz", "Salinas", "Beltrán", "Cárdenas", "Delgado", "Ibarra", "Mendoza"];
const SIM_LEVELS: Level[] = [
  "toddlers-b",
  "toddlers-a",
  "primary",
  "pre-kinder",
  "kindergarten",
  "grade-1",
  "grade-2",
  "grade-3",
  "grade-4",
  "grade-5",
  "grade-6",
];
const SIM_VEHICLES = [
  { label: "Nissan Versa gris", color: "Gris" },
  { label: "Mazda CX-5 blanca", color: "Blanca" },
  { label: "VW Jetta negro", color: "Negro" },
  { label: "Toyota Highlander plata", color: "Plata" },
  { label: "Honda Civic azul", color: "Azul" },
  { label: "Kia Forte rojo", color: "Rojo" },
];
const SIM_ACCENTS = ["#1B4D3E", "#3E6B54", "#2F5D4A", "#A4843D", "#5C7A6A", "#8F3A32"];

function randomOf<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function simDelayMs() {
  return SIM_MIN_MS + Math.floor(Math.random() * (SIM_MAX_MS - SIM_MIN_MS + 1));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function createCode(used: Set<string>) {
  let code = "";
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (used.has(code));
  return code;
}

function createToken() {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function generateFriendCode(lastName: string) {
  const base = lastName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 8) || "FAMILIA";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 3; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export class MemoryPickupStore {
  private data: Snapshot;
  private listeners = new Set<Listener>();
  private history: HistoryRow[] = [];
  private lateHistory: ArchivedLatePickup[] = [];

  lateHistoryRows() {
    return clone(this.lateHistory);
  }

  pruneHistory(cutoff: string) {
    this.history = this.history.filter((row) => row.jornada >= cutoff);
    this.lateHistory = this.lateHistory.filter((row) => row.jornada >= cutoff);
  }

  hasDailyArchives() {
    const today = todayJornada();
    return this.data.latePickups.some((late) => jornadaOf(late.createdAt) < today);
  }

  archiveDailyLates(force = false) {
    if (!this.archiveEnabled) return;
    const today = todayJornada();
    const now = new Date().toISOString();
    for (const notice of [...this.data.latePickups]) {
      const jornada = jornadaOf(notice.createdAt);
      if (!force && jornada >= today) continue;
      if (notice.status === "announced") {
        notice.status = "cancelled";
        notice.updatedAt = now;
      }
      const archived = buildLateHistoryRow(this.data, notice);
      this.lateHistory = [archived, ...this.lateHistory.filter((late) => late.id !== notice.id)].slice(0, this.historyLimit);
      this.data.latePickups = this.data.latePickups.filter((late) => late.id !== notice.id);
      this.data.events = this.data.events.filter((event) => event.lateId !== notice.id);
    }
  }

  historyRows() {
    return clone(this.history);
  }

  setArrivalPhoto(tripId: string, photo: string, notify = true) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    if (!trip) throw new Error("No encontramos esa solicitud.");
    trip.arrivalPhoto = photo;
    if (notify) this.emit();
    return this.snapshot();
  }

  archiveClosedTrips() {
    if (!this.archiveEnabled) return;
    for (const trip of [...this.data.trips]) {
      if (!trip.departedAt && !trip.cancelledAt) continue;
      this.history = [buildHistoryRow(this.data, trip), ...this.history.filter((row) => row.tripId !== trip.id)].slice(0, this.historyLimit);
      this.data.requests = this.data.requests.filter((item) => item.tripId !== trip.id);
      this.data.events = this.data.events.filter((item) => item.tripId !== trip.id);
      this.data.guestPasses = this.data.guestPasses.filter((item) => item.tripId !== trip.id);
      this.data.trips = this.data.trips.filter((item) => item.id !== trip.id);
    }
  }

  constructor(seed = createSeedSnapshot(), private historyLimit = 5000, private archiveEnabled = true) {
    this.data = hydrateStudentSurnames(seed);
    if (!Array.isArray(this.data.events)) {
      this.data.events = [];
    }
    if (!Array.isArray(this.data.latePickups)) {
      this.data.latePickups = [];
    }
    this.hydrateDefaults();
  }

  /**
   * Los snapshots guardados antes de que existieran amigos y tags no traen esos
   * campos; se completan desde el seed para no obligar a reiniciar la jornada.
   */
  private hydrateDefaults() {
    const seed = createSeedSnapshot();
    for (const guardian of this.data.guardians) {
      const base = seed.guardians.find((item) => item.id === guardian.id);
      if (!guardian.friendCode) {
        guardian.friendCode = base?.friendCode ?? generateFriendCode(guardian.lastName);
      }
      if (!Array.isArray(guardian.friendIds)) {
        guardian.friendIds = base?.friendIds ? [...base.friendIds] : [];
      }
    }
    for (const vehicle of this.data.vehicles) {
      if (vehicle.tagId) continue;
      const base = seed.vehicles.find((item) => item.id === vehicle.id);
      if (base?.tagId) vehicle.tagId = base.tagId;
    }
    // Estados intermedios de versiones anteriores ("preparing"/"ready") vuelven a la fila.
    for (const request of this.data.requests) {
      if (!isPickupStatus(request.status)) request.status = "arrived";
    }
    if (!this.data.simulation) {
      this.data.simulation = { running: false };
    }
    if (!Array.isArray(this.data.announcements)) {
      this.data.announcements = [];
    }
    if (!Array.isArray(this.data.calendarEvents)) {
      this.data.calendarEvents = [];
    }
    if (!Array.isArray(this.data.pushSubscriptions)) {
      this.data.pushSubscriptions = [];
    }
    for (const guardian of this.data.guardians) {
      if (!Array.isArray(guardian.readAnnouncementIds)) {
        guardian.readAnnouncementIds = [];
      }
    }
  }

  private guardianLabel(guardian: Guardian) {
    return `${guardian.lastName} ${guardian.firstName}`;
  }

  private ownerOf(studentId: string) {
    return this.data.guardians.find((item) => item.studentIds.includes(studentId));
  }

  private hasOpenRequests(tripId: string) {
    return this.data.requests.some(
      (request) =>
        request.tripId === tripId && request.status !== "cancelled" && request.status !== "delivered",
    );
  }

  private logEvent(event: Omit<PickupEvent, "id" | "at">, at?: string) {
    this.data.events.unshift({
      ...event,
      id: createId("ev"),
      at: at ?? new Date().toISOString(),
    });
    this.data.events = this.data.events.filter((item, index) => index < MAX_EVENTS ||
      this.data.trips.some((trip) => trip.id === item.tripId) || this.data.latePickups.some((late) => late.id === item.lateId));
  }

  snapshot() {
    return clone(this.data);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset() {
    this.archiveDailyLates(true);
    const keep = [...(this.data.pushSubscriptions ?? [])];
    this.data = createSeedSnapshot();
    this.data.pushSubscriptions = keep;
    this.emit();
    return this.snapshot();
  }

  createTrip(input: CreateTripInput) {
    if (input.studentIds.length === 0) {
      throw new Error("Selecciona al menos un alumno.");
    }

    const guardian = this.data.guardians.find((item) => item.id === input.guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");

    // Solo se puede pedir a los hijos propios o a los de familias amigas.
    const owners = new Map<string, Guardian | undefined>();
    for (const studentId of input.studentIds) {
      if (guardian.studentIds.includes(studentId)) continue;
      const owner = this.ownerOf(studentId);
      const isFriend = owner && (guardian.friendIds ?? []).includes(owner.id);
      if (!owner || !isFriend) {
        throw new Error("Solo puedes pedir a tus hijos o a los de familias amigas.");
      }
      owners.set(studentId, owner);
    }

    const alreadyActive = this.data.requests.some(
      (request) =>
        input.studentIds.includes(request.studentId) &&
        request.status !== "delivered" &&
        request.status !== "cancelled" &&
        this.data.trips.some((trip) => trip.id === request.tripId && jornadaOf(trip.createdAt) === todayJornada()),
    );
    if (alreadyActive) {
      throw new Error("Ya hay una recogida activa para uno de estos alumnos.");
    }

    if (input.pickerKind === "guest" && !input.pickerName.trim()) {
      throw new Error("Escribe el nombre de quien va a recoger.");
    }

    const now = new Date().toISOString();
    const usedCodes = new Set(this.data.trips.map((trip) => trip.code));
    const tripId = createId("t");
    const qrToken = createToken();

    this.data.trips.unshift({
      id: tripId,
      code: createCode(usedCodes),
      guardianId: input.guardianId,
      pickerName: input.pickerName.trim(),
      pickerRelationEs: input.pickerRelationEs,
      pickerRelationEn: input.pickerRelationEn,
      pickerKind: input.pickerKind,
      method: input.method,
      vehicleId: input.vehicleId,
      qrToken,
      guestPhone: input.guestPhone,
      createdAt: now,
    });

    const authorizationEvents: Array<{ requestId: string; studentId: string; owner: Guardian }> = [];
    for (const studentId of input.studentIds) {
      const owner = owners.get(studentId);
      const requestId = createId("r");
      this.data.requests.unshift({
        id: requestId,
        tripId,
        studentId,
        status: "on_the_way",
        requestedAt: now,
        authorization: owner ? { ownerGuardianId: owner.id, status: "pending" } : undefined,
      });
      if (owner) authorizationEvents.push({ requestId, studentId, owner });
    }

    this.logEvent(
      {
        type: "trip_created",
        tripId,
        actorRole: "parent",
        actorName: this.guardianLabel(guardian),
      },
      now,
    );

    for (const item of authorizationEvents) {
      this.logEvent(
        {
          type: "authorization_requested",
          tripId,
          requestId: item.requestId,
          studentId: item.studentId,
          actorRole: "parent",
          actorName: this.guardianLabel(guardian),
          note: `Se pidió confirmación a ${this.guardianLabel(item.owner)}`,
        },
        now,
      );
    }

    if (input.pickerKind === "guest" || input.pickerKind === "authorized") {
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      this.data.guestPasses.unshift({
        id: createId("p"),
        token: qrToken,
        tripId,
        phone: input.guestPhone,
        createdAt: now,
        expiresAt: expires,
      });
    }

    this.emit();
    return this.snapshot();
  }

  updateTrip(tripId: string, input: UpdateTripInput) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    if (!trip) throw new Error("No encontramos ese plan de recogida.");
    const currentRequests = this.data.requests.filter((item) => item.tripId === tripId);
    if (trip.arrivedAt || trip.cancelledAt || trip.departedAt || currentRequests.some((item) => item.status !== "on_the_way")) {
      throw new Error("El plan ya no se puede cambiar porque la familia llegó.");
    }
    if (input.studentIds.length === 0) throw new Error("Selecciona al menos un alumno.");

    const guardian = this.data.guardians.find((item) => item.id === trip.guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");
    const owners = new Map<string, Guardian>();
    for (const studentId of input.studentIds) {
      if (guardian.studentIds.includes(studentId)) continue;
      const owner = this.ownerOf(studentId);
      if (!owner || !(guardian.friendIds ?? []).includes(owner.id)) {
        throw new Error("Solo puedes incluir a tus hijos o a los de familias amigas.");
      }
      owners.set(studentId, owner);
    }
    const alreadyActive = this.data.requests.some(
      (request) =>
        request.tripId !== tripId &&
        input.studentIds.includes(request.studentId) &&
        request.status !== "delivered" &&
        request.status !== "cancelled",
    );
    if (alreadyActive) throw new Error("Ya hay una recogida activa para uno de estos alumnos.");
    if (input.pickerKind === "guest" && !input.pickerName.trim()) {
      throw new Error("Escribe el nombre de quien va a recoger.");
    }

    trip.pickerName = input.pickerName.trim();
    trip.pickerRelationEs = input.pickerRelationEs;
    trip.pickerRelationEn = input.pickerRelationEn;
    trip.pickerKind = input.pickerKind;
    trip.method = input.method;
    trip.vehicleId = input.method === "car" ? input.vehicleId : undefined;
    trip.guestPhone = input.guestPhone;

    const now = new Date().toISOString();
    const existing = new Map(currentRequests.map((request) => [request.studentId, request]));
    const nextRequests: PickupRequestRef[] = [];
    for (const studentId of input.studentIds) {
      const owner = owners.get(studentId);
      const request = existing.get(studentId);
      const requestId = request?.id ?? createId("r");
      nextRequests.push({
        id: requestId,
        tripId,
        studentId,
        status: "on_the_way",
        requestedAt: request?.requestedAt ?? now,
        authorization: owner ? { ownerGuardianId: owner.id, status: "pending" } : undefined,
      });
      if (owner) {
        this.logEvent({
          type: "authorization_requested",
          tripId,
          requestId,
          studentId,
          actorRole: "parent",
          actorName: this.guardianLabel(guardian),
          note: `Se pidió confirmación a ${this.guardianLabel(owner)}`,
        }, now);
      }
    }
    this.data.requests = [...nextRequests, ...this.data.requests.filter((request) => request.tripId !== tripId)];

    this.data.guestPasses = this.data.guestPasses.filter((item) => item.tripId !== tripId);
    if (input.pickerKind === "guest" || input.pickerKind === "authorized") {
      this.data.guestPasses.unshift({
        id: createId("p"),
        token: trip.qrToken,
        tripId,
        phone: input.guestPhone,
        createdAt: now,
        expiresAt: new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    this.logEvent({
      type: "trip_changed",
      tripId,
      actorRole: "parent",
      actorName: this.guardianLabel(guardian),
      note: "Plan de hoy actualizado",
    }, now);
    this.emit();
    return this.snapshot();
  }

  addRandomArrivals(count: number) {
    const usedCodes = new Set(this.data.trips.map((trip) => trip.code));
    const active = new Set(
      this.data.requests
        .filter((request) => request.status !== "delivered" && request.status !== "cancelled")
        .map((request) => request.studentId),
    );
    const pool = this.data.students.filter((student) => !active.has(student.id));
    const randomOf = <T,>(items: T[]): T | undefined => items[Math.floor(Math.random() * items.length)];

    for (let i = 0; i < count; i += 1) {
      const index = Math.floor(Math.random() * pool.length);
      const student = pool.splice(index, 1)[0];
      if (!student) break;

      const guardian = randomOf(this.data.guardians);
      if (!guardian) break;
      const method: ArrivalMethod = "car";
      const vehicle = randomOf(this.data.vehicles.filter((v) => v.ownerGuardianId === guardian.id));
      const arrivedAt = new Date(Date.now() - Math.floor(Math.random() * 15) * 60_000).toISOString();
      const tripId = createId("t");
      const code = createCode(usedCodes);
      usedCodes.add(code);
      const pickerName = `${guardian.lastName} ${guardian.firstName}`;

      this.data.trips.unshift({
        id: tripId,
        code,
        guardianId: guardian.id,
        pickerName,
        pickerRelationEs: guardian.relationEs,
        pickerRelationEn: guardian.relationEn,
        pickerKind: "self",
        method,
        vehicleId: vehicle?.id,
        qrToken: createToken(),
        createdAt: arrivedAt,
        arrivedAt,
        arrivalPhoto: fallbackArrivalPhoto(vehicle?.label ?? "Auto", vehicle?.color),
      });

      this.data.requests.unshift({
        id: createId("r"),
        tripId,
        studentId: student.id,
        status: "arrived",
        requestedAt: arrivedAt,
        arrivedAt,
      });

      this.logEvent({ type: "arrived", tripId, actorRole: "kiosk", actorName: pickerName }, arrivedAt);
    }

    this.emit();
    return this.snapshot();
  }

  waitingFamilyCount() {
    const trips = new Set<string>();
    for (const request of this.data.requests) {
      if (request.status !== "arrived") continue;
      trips.add(request.tripId);
    }
    return trips.size;
  }

  hasSimulationDue() {
    const sim = this.data.simulation;
    if (!sim?.running) return false;
    if (!sim.nextAt) return true;
    return Date.now() >= Date.parse(sim.nextAt);
  }

  setSimulationRunning(running: boolean) {
    if (!this.data.simulation) this.data.simulation = { running: false };
    this.data.simulation.running = running;
    if (running) {
      this.data.simulation.nextAt = new Date().toISOString();
    } else {
      delete this.data.simulation.nextAt;
    }
    this.emit();
    return this.snapshot();
  }

  tickSimulation() {
    if (!this.hasSimulationDue()) return this.snapshot();
    if (this.waitingFamilyCount() >= SIM_WAITING_CAP) {
      this.data.simulation = { running: false };
      this.emit();
      return this.snapshot();
    }
    this.addSimulatedArrival(false);
    if (this.waitingFamilyCount() >= SIM_WAITING_CAP) {
      this.data.simulation = { running: false };
    } else if (this.data.simulation?.running) {
      this.data.simulation.nextAt = new Date(Date.now() + simDelayMs()).toISOString();
    }
    this.emit();
    return this.snapshot();
  }

  addSimulatedArrival(notify = true) {
    const usedCodes = new Set(this.data.trips.map((trip) => trip.code));
    const lastName = randomOf(SIM_LAST_NAMES);
  const secondPool = SIM_LAST_NAMES.filter((name) => name !== lastName);
  const secondLastName = randomOf(secondPool.length ? secondPool : SIM_LAST_NAMES);
  const siblingCount = 1 + Math.floor(Math.random() * 3);
  const familyLastName = `${lastName} ${secondLastName}`;
  const students = Array.from({ length: siblingCount }, () => {
    const gender = Math.random() < 0.5 ? ("f" as const) : ("m" as const);
    const firstName = randomOf(gender === "f" ? SIM_FIRST_NAMES_F : SIM_FIRST_NAMES_M);
    const level = randomOf(SIM_LEVELS);
    const preschool =
      level === "toddlers-b" ||
      level === "toddlers-a" ||
      level === "primary" ||
      level === "pre-kinder" ||
      level === "kindergarten";
    return {
      id: createId("s-sim"),
      firstName,
      lastName: familyLastName,
      level,
      group: Math.random() < 0.5 ? "Grupo A" : "Grupo B",
      zoneId: preschool ? "zone-preschool" : "zone-elementary",
      dismissalTime: preschool ? "1:30 p.m." : "2:30 p.m.",
      accent: randomOf(SIM_ACCENTS),
      gender,
      photoUrl: `/students/${randomOf(gender === "f" ? ["s-sofia", "s-regina", "s-emilia", "s-isabela"] : ["s-lucas", "s-mateo", "s-diego", "s-emiliano"])}.png`,
    };
  });

  const isMom = Math.random() < 0.5;
  const guardian = {
    id: createId("g-sim"),
    firstName: randomOf(isMom ? SIM_FIRST_NAMES_F : SIM_FIRST_NAMES_M),
    lastName: familyLastName,
    relationEs: isMom ? "Mamá" : "Papá",
    relationEn: isMom ? "Mom" : "Dad",
    studentIds: students.map((student) => student.id),
    phone: `686${String(Math.floor(1000000 + Math.random() * 9000000)).slice(0, 7)}`,
    friendCode: generateFriendCode(lastName),
    friendIds: [] as string[],
    defaultVehicleId: undefined as string | undefined,
  };

    const car = randomOf(SIM_VEHICLES);
    const vehicle = {
      id: createId("v-sim"),
      label: car.label,
      color: car.color,
      plate: `SIM-${Math.floor(100 + Math.random() * 900)}`,
      ownerGuardianId: guardian.id,
      tagId: `SIM-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    guardian.defaultVehicleId = vehicle.id;

    this.data.students.unshift(...students);
    this.data.guardians.unshift(guardian);
    this.data.vehicles.unshift(vehicle);

    const via = randomOf<ArrivalVia>(["tag", "qr", "code"]);
    const unannounced = via === "tag" ? Math.random() < 0.75 : Math.random() < 0.35;
    const arrivedAt = new Date().toISOString();
    const tripId = createId("t-sim");
    const code = createCode(usedCodes);
    const pickerName = `${guardian.lastName} ${guardian.firstName}`;

    this.data.trips.unshift({
      id: tripId,
      code,
      guardianId: guardian.id,
      pickerName,
      pickerRelationEs: guardian.relationEs,
      pickerRelationEn: guardian.relationEn,
      pickerKind: "self",
      method: "car",
      vehicleId: vehicle.id,
      qrToken: createToken(),
      createdAt: arrivedAt,
      arrivedAt,
      arrivalPhoto: fallbackArrivalPhoto(vehicle.label, vehicle.color),
      arrivalVia: via,
      unannounced,
      simulated: true,
    });

    for (const student of students) {
      this.data.requests.unshift({
        id: createId("r"),
        tripId,
        studentId: student.id,
        status: "arrived",
        requestedAt: arrivedAt,
        arrivedAt,
      });
    }

    this.logEvent(
      {
        type: "arrived",
        tripId,
        actorRole: "kiosk",
        actorName: pickerName,
        note: unannounced ? `Simulación · ${via} sin aviso` : `Simulación · ${via}`,
      },
      arrivedAt,
    );

    if (notify) this.emit();
    return this.snapshot();
  }

  clearSimulatedArrivals() {
    const tripIds = new Set(
      this.data.trips
        .filter((trip) => trip.simulated || trip.id.startsWith("t-sim-") || trip.guardianId.startsWith("g-sim-"))
        .map((trip) => trip.id),
    );
    this.data.trips = this.data.trips.filter((trip) => !tripIds.has(trip.id));
    this.data.requests = this.data.requests.filter((request) => !tripIds.has(request.tripId));
    this.data.guestPasses = this.data.guestPasses.filter((pass) => !tripIds.has(pass.tripId));
    this.data.events = this.data.events.filter((event) => !event.tripId || !tripIds.has(event.tripId));
    this.removeSimulatedEntities();
    this.emit();
    return this.snapshot();
  }

  clearAllArrivals() {
    this.data.simulation = { running: false };
    this.data.trips = [];
    this.data.requests = [];
    this.data.guestPasses = [];
    this.data.events = [];
    this.removeSimulatedEntities();
    this.emit();
    return this.snapshot();
  }

  private removeSimulatedEntities() {
    const keepStudent = (id: string) => !id.startsWith("s-sim-");
    const keepGuardian = (id: string) => !id.startsWith("g-sim-");
    const keepVehicle = (id: string) => !id.startsWith("v-sim-");
    this.data.students = this.data.students.filter((student) => keepStudent(student.id));
    this.data.guardians = this.data.guardians.filter((guardian) => keepGuardian(guardian.id));
    this.data.vehicles = this.data.vehicles.filter((vehicle) => keepVehicle(vehicle.id));
    this.data.latePickups = this.data.latePickups
      .map((late) => ({
        ...late,
        studentIds: late.studentIds.filter(keepStudent),
      }))
      .filter((late) => keepGuardian(late.guardianId) && late.studentIds.length > 0);
  }

  arriveByCode(codeOrToken: string, input: ArriveTripInput = {}) {
    const value = codeOrToken.trim();
    const trip = this.data.trips.find(
      (item) => !item.cancelledAt && jornadaOf(item.createdAt) === todayJornada() && (item.code === value || item.qrToken === value),
    );
    if (!trip) throw new Error("No encontramos una solicitud con ese código.");

    this.markArrived(trip, input.photo, input.via ?? (trip.qrToken === value ? "qr" : "code"));
    this.emit();
    return this.snapshot();
  }

  /** Viaje activo (con alumnos pendientes) asociado a un vehículo con tag. */
  activeTripForTag(tagId: string) {
    const vehicle = this.data.vehicles.find((item) => item.tagId === tagId);
    if (!vehicle) return { vehicle: undefined, trip: undefined };
    const trip = this.data.trips.find(
      (item) =>
        !item.cancelledAt && jornadaOf(item.createdAt) === todayJornada() &&
        (item.vehicleId === vehicle.id || (item.guardianId === vehicle.ownerGuardianId && !item.vehicleId)) &&
        this.hasOpenRequests(item.id),
    );
    return { vehicle, trip };
  }

  arriveByTag(tagId: string, input: ArriveByTagInput = {}) {
    const { vehicle, trip } = this.activeTripForTag(tagId.trim());
    if (!vehicle) throw new Error("Ese tag no está registrado.");

    if (trip) {
      this.markArrived(trip, input.photo, "tag");
      this.emit();
      return this.snapshot();
    }

    if (!input.createIfMissing) {
      throw new Error("Esta familia no tiene una solicitud activa.");
    }

    const owner = this.data.guardians.find((item) => item.id === vehicle.ownerGuardianId);
    if (!owner) throw new Error("No encontramos a la familia de ese auto.");

    const activeStudents = new Set(
      this.data.requests
        .filter((request) => request.status !== "delivered" && request.status !== "cancelled")
        .map((request) => request.studentId),
    );
    const studentIds = owner.studentIds.filter((id) => !activeStudents.has(id));
    if (studentIds.length === 0) {
      throw new Error("Los hijos de esta familia ya tienen una recogida activa.");
    }

    const now = new Date().toISOString();
    const usedCodes = new Set(this.data.trips.map((item) => item.code));
    const created: PickupTrip = {
      id: createId("t"),
      code: createCode(usedCodes),
      guardianId: owner.id,
      pickerName: this.guardianLabel(owner),
      pickerRelationEs: owner.relationEs,
      pickerRelationEn: owner.relationEn,
      pickerKind: "self",
      method: "car",
      vehicleId: vehicle.id,
      qrToken: createToken(),
      createdAt: now,
      unannounced: true,
    };
    this.data.trips.unshift(created);
    for (const studentId of studentIds) {
      this.data.requests.unshift({
        id: createId("r"),
        tripId: created.id,
        studentId,
        status: "on_the_way",
        requestedAt: now,
      });
    }
    this.logEvent(
      {
        type: "trip_created",
        tripId: created.id,
        actorRole: "kiosk",
        actorName: created.pickerName,
        note: "Llegó sin aviso; la solicitud se creó en la entrada",
      },
      now,
    );

    this.markArrived(created, input.photo, "tag");
    this.emit();
    return this.snapshot();
  }

  private markArrived(trip: PickupTrip, photo: string | undefined, via: PickupTrip["arrivalVia"]) {
    // Volver a leer el tag o el QR de una familia que ya está en la fila no la manda al final.
    if (trip.arrivedAt) {
      if (photo) trip.arrivalPhoto = photo;
      return;
    }

    const now = new Date().toISOString();
    trip.arrivedAt = now;
    trip.arrivalVia = via;
    const vehicle = this.data.vehicles.find((item) => item.id === trip.vehicleId);
    trip.arrivalPhoto = photo || fallbackArrivalPhoto(vehicle?.label ?? trip.pickerName, vehicle?.color);

    for (const request of this.data.requests) {
      if (request.tripId !== trip.id) continue;
      if (request.status === "cancelled" || request.status === "delivered") continue;
      if (request.status === "on_the_way") {
        request.status = "arrived";
        request.arrivedAt = now;
      }
    }

    this.logEvent(
      {
        type: "arrived",
        tripId: trip.id,
        actorRole: "kiosk",
        actorName: trip.pickerName,
        note: via === "tag" ? `Tag ${vehicle?.tagId ?? ""}`.trim() : via === "qr" ? "QR" : "Código",
      },
      now,
    );
  }

  addFriend(guardianId: string, friendCode: string) {
    const guardian = this.data.guardians.find((item) => item.id === guardianId);
    if (!guardian) throw new Error("No encontramos tu cuenta.");
    const code = friendCode.trim().toUpperCase().replace(/\s+/g, "");
    const friend = this.data.guardians.find((item) => (item.friendCode ?? "").toUpperCase() === code);
    if (!friend) throw new Error("No encontramos una familia con ese código.");
    if (friend.id === guardian.id) throw new Error("Ese es tu propio código.");

    guardian.friendIds = Array.from(new Set([...(guardian.friendIds ?? []), friend.id]));
    friend.friendIds = Array.from(new Set([...(friend.friendIds ?? []), guardian.id]));
    this.emit();
    return this.snapshot();
  }

  removeFriend(guardianId: string, friendId: string) {
    const guardian = this.data.guardians.find((item) => item.id === guardianId);
    const friend = this.data.guardians.find((item) => item.id === friendId);
    if (!guardian || !friend) throw new Error("No encontramos esa familia.");
    guardian.friendIds = (guardian.friendIds ?? []).filter((id) => id !== friend.id);
    friend.friendIds = (friend.friendIds ?? []).filter((id) => id !== guardian.id);
    this.emit();
    return this.snapshot();
  }

  respondAuthorization(requestId: string, guardianId: string, decision: Exclude<AuthorizationStatus, "pending">) {
    const request = this.data.requests.find((item) => item.id === requestId);
    if (!request?.authorization) throw new Error("Esta solicitud no requiere confirmación.");
    if (request.authorization.ownerGuardianId !== guardianId) {
      throw new Error("Solo la familia del alumno puede responder.");
    }
    if (request.status === "delivered" || request.status === "cancelled") {
      throw new Error("Esta solicitud ya se cerró.");
    }

    const owner = this.data.guardians.find((item) => item.id === guardianId);
    const now = new Date().toISOString();
    const previous = request.authorization.status;
    request.authorization.status = decision;
    request.authorization.respondedAt = now;

    this.logEvent(
      {
        type: "authorization_changed",
        tripId: request.tripId,
        requestId: request.id,
        studentId: request.studentId,
        actorRole: "parent",
        actorName: owner ? this.guardianLabel(owner) : undefined,
        note:
          decision === "approved"
            ? previous === "denied"
              ? "La familia cambió su respuesta a Sí"
              : "La familia confirmó la recogida"
            : "La familia dijo que NO",
      },
      now,
    );

    this.emit();
    return this.snapshot();
  }

  setRequestStatus(requestId: string, action: "advance" | "undo" | "cancel" | "complete", staffName?: string) {
    const request = this.data.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("No encontramos esa solicitud.");

    const now = new Date().toISOString();
    this.transition(request, action, staffName, now, true);
    this.emit();
    return this.snapshot();
  }

  setTripStatus(tripId: string, action: "advance" | "undo" | "complete", staffName?: string) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    if (action === "undo" && trip?.departedAt) {
      throw new Error("Esta familia ya salió del plantel; el ciclo está cerrado.");
    }
    const requests = this.data.requests.filter((item) => {
      if (item.tripId !== tripId || item.status === "cancelled") return false;
      return action === "undo" ? item.status === "delivered" : item.status !== "delivered";
    });
    if (requests.length === 0) {
      throw new Error("No hay alumnos activos en esta familia.");
    }

    const now = new Date().toISOString();
    let changed = 0;
    for (const request of requests) {
      if (this.transition(request, action, staffName, now, false)) changed += 1;
    }
    if (changed === 0) {
      throw new Error("Ese cambio de estado no está permitido.");
    }

    this.emit();
    return this.snapshot();
  }

  private transition(
    request: PickupRequestRef,
    action: "advance" | "undo" | "cancel" | "complete",
    staffName: string | undefined,
    now: string,
    strict: boolean,
  ): boolean {
    const fail = (message: string) => {
      if (strict) throw new Error(message);
      return false;
    };

    if (action === "complete") {
      if (!canComplete(request.status)) {
        return fail("Ese cambio de estado no está permitido.");
      }
      const fromStatus = request.status;
      request.status = "delivered";
      request.deliveredAt = now;
      request.deliveredByStaffName = staffName ?? "Personal de Discovery";
      this.logEvent(
        {
          type: "delivered",
          tripId: request.tripId,
          requestId: request.id,
          studentId: request.studentId,
          actorRole: "staff",
          actorName: request.deliveredByStaffName,
          fromStatus,
          toStatus: "delivered",
        },
        now,
      );
      return true;
    }

    if (action === "cancel") {
      if (!canCancel(request.status)) {
        return fail("Esta solicitud ya no se puede cancelar.");
      }
      const fromStatus = request.status;
      request.status = "cancelled";
      const siblings = this.data.requests.filter((item) => item.tripId === request.tripId);
      const allStopped = siblings.every(
        (item) => item.status === "cancelled" || item.status === "delivered",
      );
      if (allStopped) {
        const trip = this.data.trips.find((item) => item.id === request.tripId);
        if (trip) trip.cancelledAt = now;
      }
      this.logEvent(
        {
          type: "cancelled",
          tripId: request.tripId,
          requestId: request.id,
          studentId: request.studentId,
          actorRole: staffName ? "staff" : "parent",
          actorName: staffName,
          fromStatus,
        },
        now,
      );
      return true;
    }

    const next = action === "advance" ? nextStatus(request.status) : previousStatus(request.status);
    const allowed = action === "advance" ? canAdvance(request.status) : canUndo(request.status);
    if (!allowed || !next) {
      return fail("Ese cambio de estado no está permitido.");
    }

    const fromStatus = request.status;
    request.status = next;
    Object.assign(request, applyStatusTimestamp(next, now));
    if (next === "delivered") {
      request.deliveredByStaffName = staffName ?? "Personal de Discovery";
    }

    this.logEvent(
      {
        type: next === "delivered" ? "delivered" : "status_changed",
        tripId: request.tripId,
        requestId: request.id,
        studentId: request.studentId,
        actorRole: "staff",
        actorName: staffName ?? "Personal de Discovery",
        fromStatus,
        toStatus: next,
      },
      now,
    );
    return true;
  }

  cancelTrip(tripId: string, notify = true) {
    const siblings = this.data.requests.filter((item) => item.tripId === tripId);
    if (siblings.length === 0) throw new Error("No encontramos esa solicitud.");
    if (!siblings.every((item) => canCancel(item.status))) {
      throw new Error("Esta solicitud ya no se puede cancelar.");
    }
    this.data.trips = this.data.trips.filter((item) => item.id !== tripId);
    this.data.requests = this.data.requests.filter((item) => item.tripId !== tripId);
    this.data.events = this.data.events.filter((item) => item.tripId !== tripId);
    this.data.guestPasses = this.data.guestPasses.filter((item) => item.tripId !== tripId);
    if (notify) this.emit();
    return this.snapshot();
  }

  removeStudentsFromTrip(tripId: string, studentIds: string[], note?: string) {
    const uniqueIds = [...new Set(studentIds)];
    if (uniqueIds.length === 0) throw new Error("Selecciona al menos un alumno.");

    const trip = this.data.trips.find((item) => item.id === tripId);
    if (!trip || trip.cancelledAt || trip.departedAt) {
      throw new Error("Esa recogida ya no se puede modificar.");
    }

    const targets = this.data.requests.filter(
      (item) => item.tripId === tripId && uniqueIds.includes(item.studentId),
    );
    if (targets.length !== uniqueIds.length) {
      throw new Error("Uno de esos alumnos no está en esta recogida.");
    }
    if (!targets.every((item) => canRemoveFromTrip(item.status))) {
      throw new Error("Esos alumnos ya fueron entregados y no se pueden quitar.");
    }

    const message = note?.trim() || undefined;
    const now = new Date().toISOString();
    const actorName = this.guardianName(tripId);

    for (const request of targets) {
      const fromStatus = request.status;
      request.status = "cancelled";
      const student = this.data.students.find((item) => item.id === request.studentId);
      const who = student ? student.firstName : "Alumno";
      this.logEvent(
        {
          type: "student_removed",
          tripId,
          requestId: request.id,
          studentId: request.studentId,
          actorRole: "parent",
          actorName,
          fromStatus,
          toStatus: "cancelled",
          note: message ? `${who} · ${message}` : `${who} se quedó en la escuela`,
        },
        now,
      );
    }

    const remaining = this.data.requests.filter(
      (item) => item.tripId === tripId && item.status !== "cancelled",
    );
    if (remaining.length === 0) {
      trip.cancelledAt = now;
      this.logEvent(
        {
          type: "cancelled",
          tripId,
          actorRole: "parent",
          actorName,
          note: message ?? "Se quitaron todos los alumnos de la recogida",
        },
        now,
      );
    }

    this.emit();
    return this.snapshot();
  }

  deliverTrip(tripId: string, staffName?: string) {
    const requests = this.data.requests.filter(
      (item) => item.tripId === tripId && item.status !== "cancelled" && item.status !== "delivered",
    );
    if (requests.length === 0) {
      throw new Error("No hay alumnos por entregar en esta familia.");
    }
    if (!requests.every((item) => item.status === "arrived")) {
      throw new Error("La familia aún no ha llegado.");
    }

    const now = new Date().toISOString();
    for (const request of requests) {
      request.status = "delivered";
      request.deliveredAt = now;
      request.deliveredByStaffName = staffName ?? "Personal de Discovery";
      this.logEvent(
        {
          type: "delivered",
          tripId,
          requestId: request.id,
          studentId: request.studentId,
          actorRole: "staff",
          actorName: request.deliveredByStaffName,
          fromStatus: "arrived",
          toStatus: "delivered",
        },
        now,
      );
    }

    this.emit();
    return this.snapshot();
  }

  /** Viajes con todos los alumnos entregados que aún no registran salida del plantel. */
  private openDepartures() {
    return this.data.trips.filter((trip) => {
      if (trip.cancelledAt || trip.departedAt) return false;
      const requests = this.data.requests.filter((item) => item.tripId === trip.id && item.status !== "cancelled");
      return requests.length > 0 && requests.every((item) => item.status === "delivered");
    });
  }

  private lastDeliveryAt(tripId: string) {
    return this.data.requests
      .filter((item) => item.tripId === tripId && item.deliveredAt)
      .map((item) => item.deliveredAt!)
      .sort()
      .at(-1);
  }

  closeTrip(tripId: string, via: DepartureVia, at?: string, staffName?: string) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    if (!trip) throw new Error("No encontramos esa solicitud.");
    if (trip.departedAt) return this.snapshot();
    if (!this.openDepartures().some((item) => item.id === tripId)) {
      throw new Error("Aún hay alumnos sin entregar en esta solicitud.");
    }

    const now = at ?? new Date().toISOString();
    trip.departedAt = now;
    trip.departedVia = via;
    const vehicle = this.data.vehicles.find((item) => item.id === trip.vehicleId);
    this.logEvent(
      {
        type: "departed",
        tripId,
        actorRole: via === "tag" ? "kiosk" : via === "parent" ? "parent" : "staff",
        actorName: via === "parent" ? trip.pickerName : via === "staff" ? staffName : undefined,
        note:
          via === "tag"
            ? `Salida detectada por el lector · Tag ${vehicle?.tagId ?? ""}`.trim()
            : via === "parent"
              ? "La familia confirmó la recogida en la app"
              : via === "staff"
                ? "El personal cerró el ciclo desde el tablero"
                : "Cierre automático (30 min sin confirmación)",
      },
      now,
    );
    this.emit();
    return this.snapshot();
  }

  /** Cierra solo los viajes entregados hace más de AUTO_CLOSE_MS sin confirmación. */
  closeExpiredTrips(nowMs = Date.now()) {
    let changed = 0;
    for (const trip of this.openDepartures()) {
      const delivered = this.lastDeliveryAt(trip.id);
      if (!delivered) continue;
      const deliveredMs = Date.parse(delivered);
      if (nowMs - deliveredMs < AUTO_CLOSE_MS) continue;
      this.closeTrip(trip.id, "timeout", new Date(deliveredMs + AUTO_CLOSE_MS).toISOString());
      changed += 1;
    }
    return changed;
  }

  hasExpiredTrips(nowMs = Date.now()) {
    return this.openDepartures().some((trip) => {
      const delivered = this.lastDeliveryAt(trip.id);
      return delivered ? nowMs - Date.parse(delivered) >= AUTO_CLOSE_MS : false;
    });
  }

  hasClosedTrips() {
    return this.data.trips.some((trip) => Boolean(trip.departedAt || trip.cancelledAt));
  }

  private guardianName(tripId: string) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    const guardian = trip && this.data.guardians.find((item) => item.id === trip.guardianId);
    return guardian ? `${guardian.lastName} ${guardian.firstName}` : undefined;
  }

  private guardianNameById(guardianId: string) {
    const guardian = this.data.guardians.find((item) => item.id === guardianId);
    return guardian ? `${guardian.lastName} ${guardian.firstName}` : undefined;
  }

  private findActiveLate(id: string) {
    const late = this.data.latePickups.find((item) => item.id === id);
    if (!late) throw new Error("No encontramos ese aviso de retraso.");
    if (late.status !== "announced") throw new Error("Ese aviso ya no está activo.");
    return late;
  }

  createLatePickup(input: CreateLatePickupInput) {
    if (!Array.isArray(input.studentIds) || input.studentIds.length === 0) {
      throw new Error("Selecciona al menos un alumno.");
    }
    const guardian = this.data.guardians.find((item) => item.id === input.guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");
    const eta = Date.parse(input.etaAt);
    if (Number.isNaN(eta)) throw new Error("La hora estimada no es válida.");

    const today = todayJornada();
    const eligible = lateEligibleStudentIds(this.data, guardian, today);
    if (input.studentIds.some((id) => !eligible.includes(id))) {
      throw new Error("Solo puedes avisar por tus hijos o alumnos con autorización aprobada.");
    }
    if (!input.pickerName?.trim() || !input.pickerRelationEs?.trim() || !input.pickerRelationEn?.trim() ||
      !["self", "other_guardian", "authorized", "guest"].includes(input.pickerKind)) {
      throw new Error("Indica quién va a recoger a los alumnos.");
    }
    const replacements = lateReplacementTrips(this.data, guardian.id, input.studentIds, today);
    const conflicts = this.data.requests.filter((request) => input.studentIds.includes(request.studentId) &&
      request.status !== "delivered" && request.status !== "cancelled" &&
      this.data.trips.some((trip) => trip.id === request.tripId && jornadaOf(trip.createdAt) === today));
    if (conflicts.some((request) => !replacements.some((trip) => trip.id === request.tripId))) {
      throw new Error("Hay una recogida de otro tutor. Coordínate con el tutor o la oficina.");
    }
    if (replacements.some((trip) => trip.arrivedAt || this.data.requests.some((request) =>
      request.tripId === trip.id && !canCancel(request.status)))) {
      throw new Error("La recogida ya llegó al kiosco. Contacta a la oficina.");
    }
    if ((input.note !== undefined && typeof input.note !== "string") ||
      (input.guestPhone !== undefined && typeof input.guestPhone !== "string")) {
      throw new Error("Revisa la nota y el teléfono del aviso.");
    }
    const affected = this.data.requests.filter((request) => replacements.some((trip) => trip.id === request.tripId));
    const expectedStudents = new Set(input.replaceStudentIds ?? []);
    if (expectedStudents.size !== new Set(affected.map((request) => request.studentId)).size ||
      affected.some((request) => !expectedStudents.has(request.studentId))) {
      throw new Error("El plan cambió. Revisa los alumnos que se cancelarán e intenta de nuevo.");
    }
    const expected = new Set(input.replaceTripIds ?? []);
    if (expected.size !== replacements.length || replacements.some((trip) => !expected.has(trip.id))) {
      throw new Error("El plan cambió. Revisa los alumnos que se cancelarán e intenta de nuevo.");
    }

    const duplicated = this.data.latePickups.some(
      (late) =>
        late.status === "announced" &&
        late.guardianId === guardian.id &&
        jornadaOf(late.createdAt) === today &&
        late.studentIds.some((studentId) => input.studentIds.includes(studentId)),
    );
    if (duplicated) throw new Error("Ya hay un aviso de retraso activo para estos alumnos.");

    for (const trip of replacements) this.cancelTrip(trip.id, false);

    const now = new Date().toISOString();
    const id = createId("lp");
    this.data.latePickups.unshift({
      id,
      guardianId: guardian.id,
      studentIds: [...input.studentIds],
      pickerKind: input.pickerKind,
      pickerName: input.pickerName.trim(),
      pickerRelationEs: input.pickerRelationEs,
      pickerRelationEn: input.pickerRelationEn,
      guestPhone: input.guestPhone?.trim() || undefined,
      etaAt: new Date(eta).toISOString(),
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      status: "announced",
    });

    this.logEvent(
      { type: "late_announced", lateId: id, actorRole: "parent", actorName: `${guardian.lastName} ${guardian.firstName}` },
      now,
    );
    this.emit();
    return this.snapshot();
  }

  updateLateEta(id: string, etaAt: string) {
    const late = this.findActiveLate(id);
    const eta = Date.parse(etaAt);
    if (Number.isNaN(eta)) throw new Error("La hora estimada no es válida.");
    const now = new Date().toISOString();
    late.etaAt = new Date(eta).toISOString();
    late.updatedAt = now;
    this.logEvent(
      { type: "late_eta_changed", lateId: id, actorRole: "parent", actorName: this.guardianNameById(late.guardianId) },
      now,
    );
    this.emit();
    return this.snapshot();
  }

  cancelLate(id: string) {
    const late = this.findActiveLate(id);
    const now = new Date().toISOString();
    late.status = "cancelled";
    late.updatedAt = now;
    this.logEvent(
      { type: "late_cancelled", lateId: id, actorRole: "parent", actorName: this.guardianNameById(late.guardianId) },
      now,
    );
    this.emit();
    return this.snapshot();
  }

  updateStudentPhoto(studentId: string, photoUrl: string) {
    const student = this.data.students.find((item) => item.id === studentId);
    if (!student) throw new Error("No encontramos al alumno.");
    student.photoUrl = photoUrl;
    this.emit();
    return this.snapshot();
  }

  saveVehicle(vehicle: Omit<Vehicle, "id"> & { id?: string }) {
    if (vehicle.id) {
      const current = this.data.vehicles.find((item) => item.id === vehicle.id);
      if (!current) throw new Error("No encontramos ese vehículo.");
      Object.assign(current, vehicle);
    } else {
      this.data.vehicles.push({ ...vehicle, id: createId("v") });
    }
    this.emit();
    return this.snapshot();
  }

  removeVehicle(vehicleId: string) {
    this.data.vehicles = this.data.vehicles.filter((item) => item.id !== vehicleId);
    this.emit();
    return this.snapshot();
  }

  saveAuthorized(person: Omit<AuthorizedPerson, "id"> & { id?: string }) {
    if (person.id) {
      const current = this.data.authorizedPeople.find((item) => item.id === person.id);
      if (!current) throw new Error("No encontramos a esa persona.");
      Object.assign(current, person);
    } else {
      this.data.authorizedPeople.push({ ...person, id: createId("a") });
    }
    this.emit();
    return this.snapshot();
  }

  removeAuthorized(personId: string) {
    this.data.authorizedPeople = this.data.authorizedPeople.filter((item) => item.id !== personId);
    this.emit();
    return this.snapshot();
  }

  createAnnouncement(input: {
    title: string;
    subtitle?: string;
    body: string;
    photoUrl?: string;
    authorName?: string;
  }) {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title) throw new Error("Escribe un título para el aviso.");
    if (!body) throw new Error("Escribe el contenido del aviso.");
    const now = new Date().toISOString();
    this.data.announcements.unshift({
      id: createId("an"),
      title,
      subtitle: input.subtitle?.trim() || undefined,
      body,
      photoUrl: input.photoUrl?.trim() || undefined,
      createdAt: now,
      authorName: input.authorName?.trim() || undefined,
    });
    this.emit();
    return this.snapshot();
  }

  updateAnnouncement(
    id: string,
    input: { title: string; subtitle?: string; body: string; photoUrl?: string | null },
  ) {
    const notice = this.data.announcements.find((item) => item.id === id);
    if (!notice) throw new Error("No encontramos ese aviso.");
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title) throw new Error("Escribe un título para el aviso.");
    if (!body) throw new Error("Escribe el contenido del aviso.");
    notice.title = title;
    notice.subtitle = input.subtitle?.trim() || undefined;
    notice.body = body;
    if (input.photoUrl === null) delete notice.photoUrl;
    else if (typeof input.photoUrl === "string") {
      notice.photoUrl = input.photoUrl.trim() || undefined;
    }
    this.emit();
    return this.snapshot();
  }

  deleteAnnouncement(id: string) {
    if (!this.data.announcements.some((item) => item.id === id)) {
      throw new Error("No encontramos ese aviso.");
    }
    this.data.announcements = this.data.announcements.filter((item) => item.id !== id);
    for (const guardian of this.data.guardians) {
      guardian.readAnnouncementIds = (guardian.readAnnouncementIds ?? []).filter((item) => item !== id);
    }
    this.emit();
    return this.snapshot();
  }

  markAnnouncementRead(guardianId: string, announcementId: string) {
    const guardian = this.data.guardians.find((item) => item.id === guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");
    if (!this.data.announcements.some((item) => item.id === announcementId)) {
      throw new Error("No encontramos ese aviso.");
    }
    const reads = new Set(guardian.readAnnouncementIds ?? []);
    reads.add(announcementId);
    guardian.readAnnouncementIds = [...reads];
    this.emit();
    return this.snapshot();
  }

  createCalendarEvent(input: {
    title: string;
    description?: string;
    date: string;
    time?: string;
    color?: string;
    authorName?: string;
  }) {
    const title = input.title.trim();
    if (!title) throw new Error("Escribe un título para el evento.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("La fecha del evento no es válida.");
    const time = input.time?.trim();
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error("La hora debe ser HH:MM.");
    const color = isCalendarEventColor(input.color) ? input.color : "forest";
    this.data.calendarEvents.unshift({
      id: createId("ce"),
      title,
      description: input.description?.trim() || undefined,
      date: input.date,
      time: time || undefined,
      color,
      createdAt: new Date().toISOString(),
      authorName: input.authorName?.trim() || undefined,
    });
    this.data.calendarEvents.sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));
    this.emit();
    return this.snapshot();
  }

  updateCalendarEvent(
    id: string,
    input: { title: string; description?: string; date: string; time?: string | null; color?: string },
  ) {
    const event = this.data.calendarEvents.find((item) => item.id === id);
    if (!event) throw new Error("No encontramos ese evento.");
    const title = input.title.trim();
    if (!title) throw new Error("Escribe un título para el evento.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("La fecha del evento no es válida.");
    const time = input.time === null ? undefined : input.time?.trim();
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error("La hora debe ser HH:MM.");
    event.title = title;
    event.description = input.description?.trim() || undefined;
    event.date = input.date;
    event.time = time || undefined;
    if (isCalendarEventColor(input.color)) event.color = input.color;
    this.data.calendarEvents.sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));
    this.emit();
    return this.snapshot();
  }

  deleteCalendarEvent(id: string) {
    if (!this.data.calendarEvents.some((item) => item.id === id)) {
      throw new Error("No encontramos ese evento.");
    }
    this.data.calendarEvents = this.data.calendarEvents.filter((item) => item.id !== id);
    this.emit();
    return this.snapshot();
  }

  upsertPushSubscription(record: PushSubscriptionRecord) {
    const list = [...(this.data.pushSubscriptions ?? [])].filter((item) => item.endpoint !== record.endpoint);
    list.unshift(record);
    this.data.pushSubscriptions = list.slice(0, 200);
    this.emit();
    return this.snapshot();
  }

  removePushEndpoints(endpoints: string[]) {
    if (!endpoints.length) return this.snapshot();
    const drop = new Set(endpoints);
    this.data.pushSubscriptions = (this.data.pushSubscriptions ?? []).filter((item) => !drop.has(item.endpoint));
    this.emit();
    return this.snapshot();
  }

  findTripByCode(code: string) {
    return this.data.trips.find((trip) => trip.code === code && !trip.cancelledAt);
  }

  private emit() {
    if (this.archiveEnabled) {
      this.archiveDailyLates();
      this.archiveClosedTrips();
    }
    this.data.updatedAt = new Date().toISOString();
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function isPickupStatus(value: string): value is PickupStatus {
  return ["on_the_way", "arrived", "delivered", "cancelled"].includes(value);
}
