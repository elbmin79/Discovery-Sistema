import { applyStatusTimestamp, canAdvance, canCancel, canUndo, nextStatus, previousStatus } from "../pickup-machine";
import { createSeedSnapshot, fallbackArrivalPhoto } from "../seed/demo-data";
import type {
  ArriveTripInput,
  AuthorizedPerson,
  CreateTripInput,
  PickupStatus,
  Snapshot,
  Vehicle,
} from "../types";

type Listener = (snapshot: Snapshot) => void;

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

  arriveByCode(codeOrToken: string, input: ArriveTripInput = {}) {
    const value = codeOrToken.trim();
    const trip = this.data.trips.find(
      (item) => !item.cancelledAt && (item.code === value || item.qrToken === value),
    );
    if (!trip) throw new Error("No encontramos una solicitud con ese código.");

    const now = new Date().toISOString();
    trip.arrivedAt = now;
    trip.arrivalPhoto = input.photo || fallbackArrivalPhoto(trip.pickerName);

    for (const request of this.data.requests) {
      if (request.tripId !== trip.id) continue;
      if (request.status === "cancelled" || request.status === "delivered") continue;
      if (request.status === "on_the_way") {
        request.status = "arrived";
        request.arrivedAt = now;
      }
    }

    this.emit();
    return this.snapshot();
  }

  setRequestStatus(requestId: string, action: "advance" | "undo" | "cancel", staffName?: string) {
    const request = this.data.requests.find((item) => item.id === requestId);
    if (!request) throw new Error("No encontramos esa solicitud.");

    const now = new Date().toISOString();

    if (action === "cancel") {
      if (!canCancel(request.status)) {
        throw new Error("Esta solicitud ya no se puede cancelar.");
      }
      request.status = "cancelled";
      const siblings = this.data.requests.filter((item) => item.tripId === request.tripId);
      const allStopped = siblings.every(
        (item) => item.status === "cancelled" || item.status === "delivered",
      );
      if (allStopped) {
        const trip = this.data.trips.find((item) => item.id === request.tripId);
        if (trip) trip.cancelledAt = now;
      }
      this.emit();
      return this.snapshot();
    }

    const next = action === "advance" ? nextStatus(request.status) : previousStatus(request.status);
    const allowed = action === "advance" ? canAdvance(request.status) : canUndo(request.status);
    if (!allowed || !next) {
      throw new Error("Ese cambio de estado no está permitido.");
    }

    request.status = next;
    Object.assign(request, applyStatusTimestamp(next, now));
    if (next === "delivered") {
      request.deliveredByStaffName = staffName ?? "Personal de Discovery";
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
    if (!requests.every((item) => item.status === "ready")) {
      throw new Error("Aún faltan alumnos en la puerta.");
    }

    const now = new Date().toISOString();
    for (const request of requests) {
      request.status = "delivered";
      request.deliveredAt = now;
      request.deliveredByStaffName = staffName ?? "Personal de Discovery";
    }

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
