import {
  applyStatusTimestamp,
  canAdvance,
  canCancel,
  canComplete,
  canUndo,
  nextStatus,
  previousStatus,
} from "../pickup-machine";
import { createSeedSnapshot, fallbackArrivalPhoto } from "../seed/demo-data";
import type {
  ArrivalMethod,
  ArriveTripInput,
  AuthorizedPerson,
  CreateLatePickupInput,
  CreateTripInput,
  PickupEvent,
  PickupStatus,
  Snapshot,
  Vehicle,
} from "../types";

type Listener = (snapshot: Snapshot) => void;

const MAX_EVENTS = 800;

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

export class MemoryPickupStore {
  private data: Snapshot;
  private listeners = new Set<Listener>();

  constructor(seed = createSeedSnapshot()) {
    this.data = seed;
    if (!Array.isArray(this.data.events)) {
      this.data.events = [];
    }
    if (!Array.isArray(this.data.latePickups)) {
      this.data.latePickups = [];
    }
  }

  private logEvent(event: Omit<PickupEvent, "id" | "at">, at?: string) {
    this.data.events.unshift({
      ...event,
      id: createId("ev"),
      at: at ?? new Date().toISOString(),
    });
    if (this.data.events.length > MAX_EVENTS) {
      this.data.events = this.data.events.slice(0, MAX_EVENTS);
    }
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
    this.data = createSeedSnapshot();
    this.emit();
    return this.snapshot();
  }

  createTrip(input: CreateTripInput) {
    if (input.studentIds.length === 0) {
      throw new Error("Selecciona al menos un alumno.");
    }

    const guardian = this.data.guardians.find((item) => item.id === input.guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");

    const alreadyActive = this.data.requests.some(
      (request) =>
        input.studentIds.includes(request.studentId) &&
        request.status !== "delivered" &&
        request.status !== "cancelled",
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

    for (const studentId of input.studentIds) {
      this.data.requests.unshift({
        id: createId("r"),
        tripId,
        studentId,
        status: "on_the_way",
        requestedAt: now,
      });
    }

    this.logEvent(
      {
        type: "trip_created",
        tripId,
        actorRole: "parent",
        actorName: `${guardian.firstName} ${guardian.lastName}`,
      },
      now,
    );

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
      const pickerName = `${guardian.firstName} ${guardian.lastName}`;

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

  arriveByCode(codeOrToken: string, input: ArriveTripInput = {}) {
    const value = codeOrToken.trim();
    const trip = this.data.trips.find(
      (item) => !item.cancelledAt && (item.code === value || item.qrToken === value),
    );
    if (!trip) throw new Error("No encontramos una solicitud con ese código.");

    const now = new Date().toISOString();
    trip.arrivedAt = now;
    const vehicle = this.data.vehicles.find((item) => item.id === trip.vehicleId);
    trip.arrivalPhoto = input.photo || fallbackArrivalPhoto(vehicle?.label ?? trip.pickerName, vehicle?.color);

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
      },
      now,
    );

    this.linkLatesOnArrival(trip, now);

    this.emit();
    return this.snapshot();
  }

  private linkLatesOnArrival(trip: { id: string; guardianId: string; pickerName: string }, now: string) {
    const tripStudents = new Set(
      this.data.requests.filter((request) => request.tripId === trip.id).map((request) => request.studentId),
    );
    for (const late of this.data.latePickups) {
      if (late.status !== "announced" || late.guardianId !== trip.guardianId) continue;
      if (!late.studentIds.some((studentId) => tripStudents.has(studentId))) continue;
      late.status = "arrived";
      late.linkedTripId = trip.id;
      late.updatedAt = now;
      this.logEvent(
        { type: "late_arrived", lateId: late.id, tripId: trip.id, actorRole: "kiosk", actorName: trip.pickerName },
        now,
      );
    }
  }

  private autoResolveLates(staffName: string | undefined, now: string) {
    for (const late of this.data.latePickups) {
      if (late.status !== "announced" && late.status !== "arrived") continue;
      const allDelivered = late.studentIds.every((studentId) => {
        const latest = this.data.requests.find((request) => request.studentId === studentId);
        return latest?.status === "delivered";
      });
      if (!allDelivered) continue;
      late.status = "resolved";
      late.resolvedAt = now;
      late.updatedAt = now;
      this.logEvent(
        {
          type: "late_resolved",
          lateId: late.id,
          tripId: late.linkedTripId,
          actorRole: "staff",
          actorName: staffName ?? "Personal de Discovery",
        },
        now,
      );
    }
  }

  setRequestStatus(requestId: string, action: "advance" | "undo" | "cancel" | "complete", staffName?: string) {
    const request = this.data.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("No encontramos esa solicitud.");

    const now = new Date().toISOString();

    if (action === "complete") {
      if (!canComplete(request.status)) {
        throw new Error("Ese cambio de estado no está permitido.");
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
      this.autoResolveLates(staffName, now);
      this.emit();
      return this.snapshot();
    }

    if (action === "cancel") {
      if (!canCancel(request.status)) {
        throw new Error("Esta solicitud ya no se puede cancelar.");
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
      this.emit();
      return this.snapshot();
    }

    const next = action === "advance" ? nextStatus(request.status) : previousStatus(request.status);
    const allowed = action === "advance" ? canAdvance(request.status) : canUndo(request.status);
    if (!allowed || !next) {
      throw new Error("Ese cambio de estado no está permitido.");
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
    if (next === "delivered") {
      this.autoResolveLates(staffName, now);
    }

    this.emit();
    return this.snapshot();
  }

  cancelTrip(tripId: string) {
    const siblings = this.data.requests.filter((item) => item.tripId === tripId);
    if (siblings.length === 0) throw new Error("No encontramos esa solicitud.");
    if (!siblings.every((item) => canCancel(item.status))) {
      throw new Error("Esta solicitud ya no se puede cancelar.");
    }
    const now = new Date().toISOString();
    for (const request of siblings) {
      const fromStatus = request.status;
      request.status = "cancelled";
      this.logEvent(
        {
          type: "cancelled",
          tripId,
          requestId: request.id,
          studentId: request.studentId,
          actorRole: "parent",
          actorName: this.guardianName(tripId),
          fromStatus,
        },
        now,
      );
    }
    const trip = this.data.trips.find((item) => item.id === tripId);
    if (trip) trip.cancelledAt = now;
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
    if (!requests.every((item) => item.status === "ready")) {
      throw new Error("Aún faltan alumnos en la puerta.");
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
          fromStatus: "ready",
          toStatus: "delivered",
        },
        now,
      );
    }

    this.autoResolveLates(staffName, now);

    this.emit();
    return this.snapshot();
  }

  private guardianName(tripId: string) {
    const trip = this.data.trips.find((item) => item.id === tripId);
    const guardian = trip && this.data.guardians.find((item) => item.id === trip.guardianId);
    return guardian ? `${guardian.firstName} ${guardian.lastName}` : undefined;
  }

  private guardianNameById(guardianId: string) {
    const guardian = this.data.guardians.find((item) => item.id === guardianId);
    return guardian ? `${guardian.firstName} ${guardian.lastName}` : undefined;
  }

  private findActiveLate(id: string) {
    const late = this.data.latePickups.find((item) => item.id === id);
    if (!late) throw new Error("No encontramos ese aviso de retraso.");
    if (late.status !== "announced") throw new Error("Ese aviso ya no está activo.");
    return late;
  }

  createLatePickup(input: CreateLatePickupInput) {
    if (input.studentIds.length === 0) {
      throw new Error("Selecciona al menos un alumno.");
    }
    const guardian = this.data.guardians.find((item) => item.id === input.guardianId);
    if (!guardian) throw new Error("No encontramos la cuenta del padre.");
    const eta = Date.parse(input.etaAt);
    if (Number.isNaN(eta)) throw new Error("La hora estimada no es válida.");

    const inTrip = this.data.requests.some(
      (request) =>
        input.studentIds.includes(request.studentId) &&
        request.status !== "delivered" &&
        request.status !== "cancelled",
    );
    if (inTrip) throw new Error("Esos alumnos ya tienen una recogida en curso.");

    const duplicated = this.data.latePickups.some(
      (late) =>
        late.status === "announced" &&
        late.guardianId === guardian.id &&
        late.studentIds.some((studentId) => input.studentIds.includes(studentId)),
    );
    if (duplicated) throw new Error("Ya hay un aviso de retraso activo para estos alumnos.");

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
      { type: "late_announced", lateId: id, actorRole: "parent", actorName: `${guardian.firstName} ${guardian.lastName}` },
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

  markLateArrived(id: string, staffName?: string, linkedTripId?: string) {
    const late = this.findActiveLate(id);
    const now = new Date().toISOString();
    late.status = "arrived";
    late.updatedAt = now;
    if (linkedTripId) late.linkedTripId = linkedTripId;
    this.logEvent(
      {
        type: "late_arrived",
        lateId: id,
        tripId: late.linkedTripId,
        actorRole: staffName ? "staff" : "kiosk",
        actorName: staffName ?? late.pickerName,
      },
      now,
    );
    this.emit();
    return this.snapshot();
  }

  resolveLate(id: string, staffName?: string) {
    const late = this.data.latePickups.find((item) => item.id === id);
    if (!late) throw new Error("No encontramos ese aviso de retraso.");
    if (late.status !== "announced" && late.status !== "arrived") {
      throw new Error("Ese aviso ya está cerrado.");
    }
    const now = new Date().toISOString();
    late.status = "resolved";
    late.resolvedAt = now;
    late.updatedAt = now;
    this.logEvent(
      {
        type: "late_resolved",
        lateId: id,
        tripId: late.linkedTripId,
        actorRole: "staff",
        actorName: staffName ?? "Personal de Discovery",
      },
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

  findTripByCode(code: string) {
    return this.data.trips.find((trip) => trip.code === code && !trip.cancelledAt);
  }

  private emit() {
    this.data.updatedAt = new Date().toISOString();
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function isPickupStatus(value: string): value is PickupStatus {
  return ["on_the_way", "arrived", "preparing", "ready", "delivered", "cancelled"].includes(value);
}
