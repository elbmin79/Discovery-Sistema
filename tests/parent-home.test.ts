import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryPickupStore } from "../src/lib/store/memory-store";
import { createSeedSnapshot } from "../src/lib/seed/demo-data";
import { lateEligibleStudentIds, lateReplacementTrips } from "../src/lib/parent-home";
import { todayJornada } from "../src/lib/school";
import type { CreateLatePickupInput } from "../src/lib/types";

function setup() {
  const seed = createSeedSnapshot();
  seed.latePickups = [];
  const store = new MemoryPickupStore(seed);
  const snapshot = store.snapshot();
  const trip = snapshot.trips.find((item) => item.id === "t-madrid-today")!;
  const guardian = snapshot.guardians.find((item) => item.id === trip.guardianId)!;
  const studentIds = snapshot.requests.filter((request) => request.tripId === trip.id).map((request) => request.studentId);
  const input: CreateLatePickupInput = {
    guardianId: guardian.id, studentIds, replaceTripIds: [trip.id], replaceStudentIds: studentIds,
    pickerKind: "self", pickerName: "Roberto Madrid", pickerRelationEs: "Papá", pickerRelationEn: "Dad",
    etaAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  return { store, trip, guardian, input };
}

test("late replacement publishes once with cancellation history and an invalidated pass", () => {
  const { store, trip, input } = setup();
  let notifications = 0;
  store.subscribe((snapshot) => {
    notifications++;
    assert.equal(snapshot.trips.some((item) => item.id === trip.id), false);
    assert.equal(snapshot.latePickups.filter((item) => item.guardianId === input.guardianId).length, 1);
  });
  const snapshot = store.createLatePickup(input);
  assert.equal(notifications, 1);
  const history = store.historyRows().find((row) => row.tripId === trip.id)!;
  assert.equal(history.status, "cancelled");
  assert.equal(history.detail?.events.filter((event) => event.type === "cancelled").length, input.studentIds.length);
  assert.ok(snapshot.events.some((event) => event.type === "late_announced"));
  assert.throws(() => store.arriveByCode(trip.code));
  assert.throws(() => store.arriveByCode(trip.qrToken));
  assert.equal(store.activeTripForTag("DSC-0417").trip, undefined);
});

test("invalid payloads and undisclosed cancellation leave the plan and audit untouched", () => {
  for (const change of [
    { etaAt: "invalid" }, { studentIds: [] }, { pickerName: "" },
    { replaceTripIds: [] }, { replaceStudentIds: [] },
    { studentIds: ["unknown"] }, { note: 123 as unknown as string },
  ]) {
    const { store, input } = setup();
    const before = store.snapshot();
    assert.throws(() => store.createLatePickup({ ...input, ...change }));
    assert.deepEqual(store.snapshot(), before);
    assert.equal(store.historyRows().length, 0);
  }
});

test("arrival winning the race leaves the arrived trip intact", () => {
  const { store, input, trip } = setup();
  store.arriveByCode(trip.code);
  const before = store.snapshot();
  assert.throws(() => store.createLatePickup(input), /kiosco/);
  assert.deepEqual(store.snapshot(), before);
});

test("another guardian's trip cannot be cancelled by a late notice", () => {
  const { store, input, trip } = setup();
  const seed = store.snapshot();
  seed.trips.find((item) => item.id === trip.id)!.guardianId = "g-other";
  const other = new MemoryPickupStore(seed);
  const before = other.snapshot();
  assert.throws(() => other.createLatePickup(input), /otro tutor/);
  assert.deepEqual(other.snapshot(), before);
});

test("partial late selection cancels the disclosed whole sibling plan", () => {
  const { store, input, trip } = setup();
  const snapshot = store.createLatePickup({ ...input, studentIds: input.studentIds.slice(0, 1) });
  assert.equal(snapshot.trips.some((item) => item.id === trip.id), false);
  assert.equal(snapshot.latePickups[0].studentIds.length, 1);
  assert.equal(store.historyRows().find((row) => row.tripId === trip.id)!.detail?.requests.length, input.studentIds.length);
});

test("duplicate notice is harmless and a later pass does not resolve the notice", () => {
  const { store, input, guardian } = setup();
  store.createLatePickup(input);
  const before = store.snapshot();
  assert.throws(() => store.createLatePickup({ ...input, replaceTripIds: [], replaceStudentIds: [] }), /aviso/);
  assert.deepEqual(store.snapshot(), before);
  const snapshot = store.createTrip({ ...input, method: "car", vehicleId: guardian.defaultVehicleId });
  assert.equal(snapshot.latePickups[0].status, "announced");
  store.arriveByCode(snapshot.trips[0].code);
  assert.equal(store.snapshot().latePickups[0].status, "announced");
});

test("notice without a plan can be updated or cancelled without recreating a pass", () => {
  const { store, input, trip } = setup();
  store.cancelTrip(trip.id);
  const snapshot = store.createLatePickup({ ...input, replaceTripIds: [], replaceStudentIds: [] });
  const notice = snapshot.latePickups[0];
  const eta = new Date(Date.now() + 60 * 60_000).toISOString();
  assert.equal(store.updateLateEta(notice.id, eta).latePickups[0].etaAt, eta);
  const cancelled = store.cancelLate(notice.id);
  assert.equal(cancelled.latePickups[0].status, "cancelled");
  assert.equal(cancelled.trips.some((item) => item.guardianId === input.guardianId), false);
});

test("yesterday's plan and notice do not prevent today's new plan or notice", () => {
  const { store, input, trip, guardian } = setup();
  const seed = store.snapshot();
  seed.trips.find((item) => item.id === trip.id)!.createdAt = "2020-01-01T20:00:00Z";
  seed.latePickups.push({ ...input, id: "old", createdAt: "2020-01-01T20:00:00Z", updatedAt: "2020-01-01T20:00:00Z", status: "announced" });
  const current = new MemoryPickupStore(seed);
  assert.deepEqual(lateReplacementTrips(seed, guardian.id, input.studentIds, todayJornada()), []);
  current.createLatePickup({ ...input, replaceTripIds: [], replaceStudentIds: [] });
  const snapshot = current.createTrip({ ...input, method: "car", vehicleId: guardian.defaultVehicleId });
  assert.ok(snapshot.trips.some((item) => item.id !== trip.id && item.guardianId === guardian.id));
  assert.throws(() => current.arriveByCode(trip.code));
});

test("friend children need approved pickup authorization for late notices", () => {
  const { store, guardian, trip } = setup();
  const seed = store.snapshot();
  const friend = seed.students.find((student) => !guardian.studentIds.includes(student.id))!;
  seed.requests.push({ ...seed.requests.find((request) => request.tripId === trip.id)!, id: "friend", studentId: friend.id,
    authorization: { ownerGuardianId: "owner", status: "pending" } });
  assert.equal(lateEligibleStudentIds(seed, guardian, todayJornada()).includes(friend.id), false);
  seed.requests.find((request) => request.id === "friend")!.authorization!.status = "approved";
  assert.equal(lateEligibleStudentIds(seed, guardian, todayJornada()).includes(friend.id), true);
});
