export type Locale = "es" | "en";

export type Role = "parent" | "staff" | "kiosk" | "admin";

export type Level =
  | "toddlers-b"
  | "toddlers-a"
  | "primary"
  | "pre-kinder"
  | "kindergarten"
  | "grade-1"
  | "grade-2"
  | "grade-3"
  | "grade-4"
  | "grade-5"
  | "grade-6";

/** on_the_way = la familia avisó · arrived = en la fila · delivered = entregado */
export type PickupStatus = "on_the_way" | "arrived" | "delivered" | "cancelled";

export type ArrivalMethod = "car" | "walk";

export type PickerKind = "self" | "other_guardian" | "authorized" | "guest";

export interface ExitZone {
  id: string;
  nameEs: string;
  nameEn: string;
  shortEs: string;
  shortEn: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  level: Level;
  group: string;
  zoneId: string;
  dismissalTime: string;
  accent: string;
  gender: "f" | "m";
  photoUrl?: string;
}

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  relationEs: string;
  relationEn: string;
  studentIds: string[];
  defaultVehicleId?: string;
  phone: string;
  /** Código que se comparte con otras familias para agregarse como amigos. */
  friendCode?: string;
  friendIds?: string[];
}

export interface AuthorizedPerson {
  id: string;
  firstName: string;
  lastName: string;
  relationEs: string;
  relationEn: string;
  studentIds: string[];
}

export interface Vehicle {
  id: string;
  label: string;
  color: string;
  plate?: string;
  ownerGuardianId: string;
  photoUrl?: string;
  /** Tag RFID pegado al parabrisas; lo lee el sensor de la entrada. */
  tagId?: string;
}

export type ArrivalVia = "tag" | "qr" | "code";

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  titleEs: string;
  titleEn: string;
}

export interface PickupTrip {
  id: string;
  code: string;
  guardianId: string;
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  pickerKind: PickerKind;
  method: ArrivalMethod;
  vehicleId?: string;
  qrToken: string;
  guestPhone?: string;
  createdAt: string;
  arrivedAt?: string;
  arrivalPhoto?: string;
  arrivalVia?: ArrivalVia;
  /** La familia llegó sin haber avisado desde la app; el kiosco creó la solicitud. */
  unannounced?: boolean;
  /** Cierre del ciclo: el auto salió del plantel (o la familia lo confirmó). */
  departedAt?: string;
  departedVia?: DepartureVia;
  cancelledAt?: string;
}

/**
 * tag = lector de salida · parent = la familia confirmó en la app ·
 * staff = el personal lo cerró desde el tablero · timeout = cierre automático
 */
export type DepartureVia = "tag" | "parent" | "staff" | "timeout";

export type AuthorizationStatus = "pending" | "approved" | "denied";

/** Presente solo cuando el alumno no es hijo de quien hizo la solicitud. */
export interface RequestAuthorization {
  ownerGuardianId: string;
  status: AuthorizationStatus;
  respondedAt?: string;
}

export interface GuestPass {
  id: string;
  token: string;
  tripId: string;
  phone?: string;
  createdAt: string;
  expiresAt: string;
}

export interface PickupRequest {
  id: string;
  tripId: string;
  studentId: string;
  status: PickupStatus;
  requestedAt: string;
  arrivedAt?: string;
  deliveredAt?: string;
  deliveredByStaffName?: string;
  authorization?: RequestAuthorization;
}

export type LatePickupStatus = "announced" | "cancelled";

export interface LatePickup {
  id: string;
  guardianId: string;
  studentIds: string[];
  pickerKind: PickerKind;
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  guestPhone?: string;
  etaAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  status: LatePickupStatus;
}

export interface CreateLatePickupInput {
  guardianId: string;
  studentIds: string[];
  pickerKind: PickerKind;
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  guestPhone?: string;
  etaAt: string;
  note?: string;
}

export type EventActorRole = "parent" | "kiosk" | "staff";

export type PickupEventType =
  | "trip_created"
  | "arrived"
  | "status_changed"
  | "delivered"
  | "cancelled"
  | "authorization_requested"
  | "authorization_changed"
  | "departed"
  | "late_announced"
  | "late_eta_changed"
  | "late_cancelled";

export interface PickupEvent {
  id: string;
  at: string;
  type: PickupEventType;
  tripId?: string;
  requestId?: string;
  studentId?: string;
  lateId?: string;
  actorRole: EventActorRole;
  actorName?: string;
  fromStatus?: PickupStatus;
  toStatus?: PickupStatus;
  note?: string;
}

export interface Snapshot {
  school: {
    name: string;
    city: string;
    address: string;
  };
  zones: ExitZone[];
  students: Student[];
  guardians: Guardian[];
  authorizedPeople: AuthorizedPerson[];
  vehicles: Vehicle[];
  staff: StaffMember[];
  trips: PickupTrip[];
  requests: PickupRequest[];
  guestPasses: GuestPass[];
  latePickups: LatePickup[];
  events: PickupEvent[];
  updatedAt: string;
}

export interface CreateTripInput {
  guardianId: string;
  studentIds: string[];
  pickerKind: PickerKind;
  pickerName: string;
  pickerRelationEs: string;
  pickerRelationEn: string;
  method: ArrivalMethod;
  vehicleId?: string;
  guestPhone?: string;
}

export type SessionRole = "parent" | "staff";

export interface DemoSession {
  role: SessionRole;
  name: string;
  username: string;
  guardianId?: string;
  staffId?: string;
}

export interface ArriveTripInput {
  photo?: string;
  via?: ArrivalVia;
}

export interface ArriveByTagInput extends ArriveTripInput {
  /** Si la familia no avisó, crear la solicitud con todos sus hijos y marcarla llegada. */
  createIfMissing?: boolean;
}
