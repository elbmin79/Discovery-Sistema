import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryPickupStore, AUTO_CLOSE_MS } from "../src/lib/store/memory-store";
import { createSeedSnapshot } from "../src/lib/seed/demo-data";
import { buildHistoryRow, buildLiveHistoryRows, historyPage, validJornada } from "../src/lib/history";
import { buildAdminRows } from "../src/lib/admin-dashboard";
import { jornadaOf } from "../src/lib/school";
import { retentionCutoff } from "../src/lib/store/history-maintenance";
import { sessionCookie, serverSession } from "../src/lib/auth/server-session";

function setup() {
  const seed = createSeedSnapshot();
  seed.trips = [];
  seed.requests = [];
  seed.events = [];
  seed.guestPasses = [];
  const store = new MemoryPickupStore(seed);
  const guardian = seed.guardians.find((item) => item.studentIds.length)!;
  const snapshot = store.createTrip({ guardianId: guardian.id, studentIds: guardian.studentIds,
    pickerKind: "authorized", pickerName: "Persona autorizada", pickerRelationEs: "Familiar",
    pickerRelationEn: "Relative", method: "car", vehicleId: guardian.defaultVehicleId });
  return { store, trip: snapshot.trips[0] };
}

test("database backfill retains every record beyond the memory-only 5000 row cap", () => {
  const seed = createSeedSnapshot();
  const trip = seed.trips[0];
  const request = seed.requests.find((item) => item.tripId === trip.id)!;
  seed.trips = Array.from({ length: 5001 }, (_, index) => ({ ...trip, id: `bulk-${index}`, cancelledAt: new Date().toISOString() }));
  seed.requests = seed.trips.map((item, index) => ({ ...request, id: `request-${index}`, tripId: item.id, status: "cancelled" }));
  seed.events = [];
  seed.guestPasses = [];
  const store = new MemoryPickupStore(seed, Infinity);
  store.archiveClosedTrips();
  assert.equal(store.historyRows().length, 5001);
  assert.equal(store.snapshot().trips.length, 0);
  assert.equal(store.snapshot().requests.length, 0);
});

test("departure archives a complete trip and removes only its live records", () => {
  const { store, trip } = setup();
  store.arriveByCode(trip.code);
  store.deliverTrip(trip.id, "Maestra");
  assert.equal(store.historyRows().length, 0);
  assert.ok(store.snapshot().trips.some((item) => item.id === trip.id));
  const result = store.closeTrip(trip.id, "parent");
  for (const collection of [result.trips, result.requests, result.events, result.guestPasses]) {
    assert.equal(collection.some((item) => "tripId" in item ? item.tripId === trip.id : item.id === trip.id), false);
  }
  const row = store.historyRows()[0];
  assert.equal(row.status, "delivered");
  assert.equal(row.deliveredBy, "Maestra");
  assert.ok(row.detail?.events.some((event) => event.type === "departed"));
  assert.ok(row.detail?.requests.every((request) => request.status === "delivered"));
  store.archiveClosedTrips();
  assert.equal(store.historyRows().length, 1);
});

test("cancellation deletes the pickup while timeout preserves delivery history", () => {
  const { store, trip } = setup();
  store.cancelTrip(trip.id);
  assert.equal(store.historyRows().length, 0);
  assert.equal(store.snapshot().trips.length, 0);
  store.reset();
  assert.equal(store.historyRows().some((row) => row.tripId === trip.id), false);
  const next = setup();
  next.store.arriveByCode(next.trip.code);
  next.store.deliverTrip(next.trip.id);
  const delivered = next.store.snapshot().requests[0].deliveredAt!;
  assert.equal(next.store.closeExpiredTrips(Date.parse(delivered) + AUTO_CLOSE_MS), 1);
  assert.equal(next.store.historyRows()[0].departedVia, "timeout");
  assert.equal(next.store.closeExpiredTrips(Date.parse(delivered) + AUTO_CLOSE_MS), 0);
});

test("history preserves local jornada, live status, range summaries and pagination", () => {
  assert.equal(jornadaOf("2026-09-04T02:00:00Z"), "2026-09-03");
  assert.equal(validJornada("2026-02-30"), false);
  assert.equal(validJornada("2026-09-03"), true);
  const { store, trip } = setup();
  const row = buildHistoryRow(store.snapshot(), trip, true);
  assert.equal(row.status, "on_the_way");
  const page = historyPage([{ ...row, jornada: "2026-09-03" }, { ...row, tripId: "other", jornada: "2026-09-02", status: "delivered", waitMinutes: 4 }], "2026-09-02", "2026-09-03", 1, 1);
  assert.equal(page.total, 2);
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].tripId, "other");
  assert.equal(page.summary.delivered, 1);
  assert.equal(page.summary.averageWait, 4);
  assert.equal(page.days[0].jornada, "2026-09-02");
});

test("daily rollover keeps late notices even without a pickup and applies 90-day retention", () => {
  const seed = createSeedSnapshot();
  const student = seed.students[0];
  seed.latePickups = [{ id: "late-past", guardianId: seed.guardians[0].id, studentIds: [student.id],
    pickerKind: "self", pickerName: "Mamá", pickerRelationEs: "Madre", pickerRelationEn: "Mother",
    etaAt: "2026-01-01T23:00:00Z", createdAt: "2026-01-01T20:00:00Z", updatedAt: "2026-01-01T21:00:00Z", status: "announced", note: "Tráfico" }];
  const store = new MemoryPickupStore(seed);
  assert.equal(store.hasDailyArchives(), true);
  store.archiveDailyLates();
  assert.equal(store.snapshot().latePickups.length, 0);
  assert.equal(store.lateHistoryRows()[0].notice.note, "Tráfico");
  const page = historyPage([], "2026-01-01", "2026-01-01", 200, 0, store.lateHistoryRows());
  assert.equal(page.days[0].latePickups[0].studentNames[0], `${student.lastName} ${student.firstName}`);
  assert.equal(retentionCutoff("2026-04-01"), "2026-01-01");
  store.pruneHistory("2026-01-01");
  assert.equal(store.lateHistoryRows().length, 1);
  store.pruneHistory("2026-01-02");
  assert.equal(store.lateHistoryRows().length, 0);
});

test("unavailable history storage defers archival without dropping live records", () => {
  const seed = createSeedSnapshot();
  seed.trips = [];
  seed.requests = [];
  seed.events = [];
  seed.guestPasses = [];
  const student = seed.students[0];
  seed.latePickups = [{ id: "late-deferred", guardianId: seed.guardians[0].id, studentIds: [student.id],
    pickerKind: "self", pickerName: "Mamá", pickerRelationEs: "Madre", pickerRelationEn: "Mother",
    etaAt: "2026-01-01T23:00:00Z", createdAt: "2026-01-01T20:00:00Z", updatedAt: "2026-01-01T21:00:00Z", status: "announced" }];
  const store = new MemoryPickupStore(seed, Infinity, false);
  const guardian = seed.guardians[0];
  const created = store.createTrip({ guardianId: guardian.id, studentIds: [guardian.studentIds[0]],
    pickerKind: "self", pickerName: `${guardian.firstName} ${guardian.lastName}`,
    pickerRelationEs: guardian.relationEs, pickerRelationEn: guardian.relationEn,
    method: "car", vehicleId: guardian.defaultVehicleId });
  const trip = created.trips[0];
  store.arriveByCode(trip.code);
  store.deliverTrip(trip.id);
  const deferred = store.closeTrip(trip.id, "parent");
  assert.equal(store.historyRows().length, 0);
  assert.equal(deferred.trips.find((item) => item.id === trip.id)?.departedAt !== undefined, true);
  assert.equal(store.hasClosedTrips(), true);
  store.archiveClosedTrips();
  assert.equal(store.snapshot().trips.some((item) => item.id === trip.id), true);
  assert.equal(store.hasDailyArchives(), true);
  store.archiveDailyLates();
  assert.equal(store.snapshot().latePickups.some((item) => item.id === "late-deferred"), true);

  const recovered = new MemoryPickupStore(store.snapshot(), Infinity, true);
  recovered.archiveClosedTrips();
  recovered.archiveDailyLates();
  assert.equal(recovered.snapshot().trips.some((item) => item.id === trip.id), false);
  assert.equal(recovered.historyRows()[0].tripId, trip.id);
  assert.equal(recovered.snapshot().latePickups.some((item) => item.id === "late-deferred"), false);
  assert.equal(recovered.lateHistoryRows()[0].notice.id, "late-deferred");
});

test("server sessions cannot be forged by browser role changes", () => {
  const cookie = sessionCookie({ name: "Office", username: "gabriela", role: "staff", isAdmin: true }, false).split(";")[0];
  assert.equal(serverSession(new Request("http://localhost", { headers: { cookie } }))?.isAdmin, true);
  assert.equal(serverSession(new Request("http://localhost")), null);
  const [key, value] = cookie.split("=");
  const [payload, signature] = value.split(".");
  const modified = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), name: "forged" })).toString("base64url");
  assert.equal(serverSession(new Request("http://localhost", { headers: { cookie: `${key}=${modified}.${signature}` } })), null);
});

test("demo families start with an inert plan for all their children", () => {
  const snapshot = createSeedSnapshot();
  for (const guardianId of ["g-roberto", "g-benjamin"]) {
    const guardian = snapshot.guardians.find((item) => item.id === guardianId)!;
    const trip = snapshot.trips.find((item) => item.guardianId === guardianId)!;
    const requests = snapshot.requests.filter((item) => item.tripId === trip.id);
    assert.deepEqual(new Set(requests.map((item) => item.studentId)), new Set(guardian.studentIds));
    assert.ok(requests.every((item) => item.status === "on_the_way"));
    assert.equal(trip.vehicleId, guardian.defaultVehicleId);
  }
});

test("today plan can change before arrival without replacing its pass", () => {
  const seed = createSeedSnapshot();
  const store = new MemoryPickupStore(seed);
  const trip = seed.trips.find((item) => item.id === "t-madrid-today")!;
  const token = trip.qrToken;
  const code = trip.code;
  const result = store.updateTrip(trip.id, {
    studentIds: ["s-sofia"],
    pickerKind: "guest",
    pickerName: "Tía Elena",
    pickerRelationEs: "Tía",
    pickerRelationEn: "Aunt",
    guestPhone: "6865550101",
    method: "car",
    vehicleId: "v-prius",
  });
  const updated = result.trips.find((item) => item.id === trip.id)!;
  assert.equal(updated.qrToken, token);
  assert.equal(updated.code, code);
  assert.deepEqual(result.requests.filter((item) => item.tripId === trip.id).map((item) => item.studentId), ["s-sofia"]);
  assert.equal(result.guestPasses.find((item) => item.tripId === trip.id)?.token, token);
  assert.ok(result.events.some((event) => event.tripId === trip.id && event.type === "trip_changed"));
});

test("today plan cannot change after arrival", () => {
  const seed = createSeedSnapshot();
  const store = new MemoryPickupStore(seed);
  const trip = seed.trips.find((item) => item.id === "t-madrid-today")!;
  store.arriveByCode(trip.code);
  assert.throws(() => store.updateTrip(trip.id, {
    studentIds: ["s-sofia"], pickerKind: "self", pickerName: "Roberto Madrid",
    pickerRelationEs: "Papá", pickerRelationEn: "Dad", method: "car", vehicleId: "v-prius",
  }), /ya no se puede cambiar/);
});

test("inert plans stay out of school-facing dashboard and live history", () => {
  const snapshot = createSeedSnapshot();
  const inertTripIds = new Set(snapshot.trips.filter((trip) => !trip.arrivedAt).map((trip) => trip.id));
  assert.ok(inertTripIds.has("t-madrid-today"));
  assert.equal(buildAdminRows(snapshot).some((row) => inertTripIds.has(row.tripId)), false);
  assert.equal(buildLiveHistoryRows(snapshot).some((row) => inertTripIds.has(row.tripId)), false);
});
