import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryPickupStore, AUTO_CLOSE_MS } from "../src/lib/store/memory-store";
import { createSeedSnapshot } from "../src/lib/seed/demo-data";
import { buildHistoryRow, historyPage, validJornada } from "../src/lib/history";
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

test("cancellation and timeout archive and survive a new demo day", () => {
  const { store, trip } = setup();
  store.cancelTrip(trip.id);
  assert.equal(store.historyRows()[0].status, "cancelled");
  assert.equal(store.snapshot().trips.length, 0);
  store.reset();
  assert.ok(store.historyRows().some((row) => row.tripId === trip.id));
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
  assert.equal(page.days[0].latePickups[0].studentNames[0], `${student.firstName} ${student.lastName}`);
  assert.equal(retentionCutoff("2026-04-01"), "2026-01-01");
  store.pruneHistory("2026-01-01");
  assert.equal(store.lateHistoryRows().length, 1);
  store.pruneHistory("2026-01-02");
  assert.equal(store.lateHistoryRows().length, 0);
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
