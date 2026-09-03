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
  ArriveByTagInput,
  ArriveTripInput,
  AuthorizationStatus,
  AuthorizedPerson,
  CreateLatePickupInput,
  CreateTripInput,
  DepartureVia,
  Guardian,
  PickupEvent,
  PickupStatus,
  PickupTrip,
  Snapshot,
  Vehicle,
} from "../types";

type Listener = (snapshot: Snapshot) => void;
type PickupRequestRef = Snapshot["requests"][number];

const MAX_EVENTS = 800;
export const AUTO_CLOSE_MS = 30 * 60 * 1000;

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

  constructor(seed = createSeedSnapshot()) {
    this.data = seed;
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
  }

  private guardianLabel(guardian: Guardian) {
    return `${guardian.firstName} ${guardian.lastName}`;
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
        !item.cancelledAt &&
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
  return ["on_the_way", "arrived", "delivered", "cancelled"].includes(value);
}
