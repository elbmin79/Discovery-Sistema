import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryPickupStore } from "../src/lib/store/memory-store";
import { createSeedSnapshot, withDemoFamilyPlans } from "../src/lib/seed/demo-data";
import { lateEligibleStudentIds, lateReplacementTrips, parentName, parentPickerName } from "../src/lib/parent-home";
import { studentName, studentPhoto, todayJornada } from "../src/lib/school";
import type { CreateLatePickupInput } from "../src/lib/types";
import { existsSync } from "node:fs";
import { hydrateStudentSurnames } from "../src/lib/student-surnames";

test("demo surnames upgrade saved students without resetting pickups or overwriting names", () => {
  const snapshot = createSeedSnapshot();
  assert.ok(snapshot.students.every((student) => student.lastName.split(" ").length >= 2));
  const sofia = snapshot.students.find((student) => student.id === "s-sofia")!;
  sofia.lastName = "Madrid";
  const before = structuredClone(snapshot.trips);
  hydrateStudentSurnames(snapshot);
  assert.equal(sofia.lastName, "Madrid Herrera");
  assert.deepEqual(snapshot.trips, before);
  const upgraded = structuredClone(snapshot);
  hydrateStudentSurnames(snapshot);
  assert.deepEqual(snapshot, upgraded);
  sofia.lastName = "De la Torre Hernández";
  hydrateStudentSurnames(snapshot);
  assert.equal(sofia.lastName, "De la Torre Hernández");
});

test("family names are first-last while school displays remain last-first", () => {
  const snapshot = withDemoFamilyPlans(createSeedSnapshot());
  const student = snapshot.students.find((student) => student.id === "s-sofia")!;
  const trip = snapshot.trips.find((trip) => trip.id === "t-madrid-today")!;
  assert.equal(parentName(student), "Sofía Madrid Herrera");
  assert.equal(studentName(student), "Madrid Herrera Sofía");
  assert.equal(parentPickerName(snapshot, trip), "Roberto Madrid");
  assert.equal(trip.pickerName, "Roberto Madrid");
  for (const pickerName of ["Madrid Rosa", "Rosa Madrid"]) {
    assert.equal(parentPickerName(snapshot, { ...trip, pickerKind: "authorized", pickerName }), "Rosa Madrid");
  }
  assert.equal(parentPickerName(snapshot, { ...trip, pickerKind: "guest", pickerName: "María del Carmen Ruiz" }), "María del Carmen Ruiz");
  assert.equal(parentName({ firstName: "Ana María", lastName: "López García" }), "Ana María López García");
  snapshot.trips[0].pickerName = "Madrid Roberto";
  snapshot.events.push({ id: "legacy-parent", at: new Date().toISOString(), type: "trip_changed", actorRole: "parent", actorName: "Madrid Roberto" });
  const normalized = new MemoryPickupStore(snapshot).snapshot();
  assert.equal(normalized.trips[0].pickerName, "Roberto Madrid");
  assert.equal(normalized.events.find((event) => event.id === "legacy-parent")?.actorName, "Roberto Madrid");
});

test("cancelled pickups leave no records or usable guest passes", () => {
  const { store, trip } = setup();
  const before = store.snapshot();
  const after = store.cancelTrip(trip.id);
  assert.equal(after.trips.some((item) => item.id === trip.id), false);
  for (const records of [after.requests, after.events, after.guestPasses]) {
    assert.equal(records.some((item) => item.tripId === trip.id), false);
  }
  assert.equal(store.historyRows().some((item) => item.tripId === trip.id), false);
  assert.deepEqual(after.students, before.students);
  assert.throws(() => store.arriveByCode(trip.qrToken));
  assert.throws(() => store.arriveByCode(trip.code));
});

test("delivered pickups cannot be deleted by cancellation", () => {
  const { store, trip } = setup();
  store.arriveByCode(trip.code);
  store.deliverTrip(trip.id);
  const before = store.snapshot();
  assert.throws(() => store.cancelTrip(trip.id));
  assert.deepEqual(store.snapshot(), before);
});

for (const arrivalVia of ["qr", "tag"] as const) {
  test(`an accepted ${arrivalVia} pickup can be cancelled with an audit record`, () => {
    const { store, trip } = setup();
    if (arrivalVia === "tag") store.arriveByTag("DSC-0417");
    else store.arriveByCode(trip.qrToken, { via: "qr" });
    const after = store.cancelTrip(trip.id);
    assert.equal(after.trips.some((item) => item.id === trip.id), false);
    assert.equal(after.requests.some((item) => item.tripId === trip.id), false);
    const history = store.historyRows().find((row) => row.tripId === trip.id)!;
    assert.equal(history.status, "cancelled");
    assert.equal(history.arrivalVia, arrivalVia);
    assert.ok(history.detail?.requests.every((request) => request.status === "cancelled"));
    assert.ok(history.detail?.events.some((event) => event.type === "cancelled" && event.actorName === "Roberto Madrid"));
  });
}

test("simulated children use available portraits including older persisted simulations", () => {
  const { store } = setup();
  for (let index = 0; index < 10; index++) store.addSimulatedArrival();
  const simulated = store.snapshot().students.filter((student) => student.id.startsWith("s-sim"));
  assert.ok(simulated.length >= 10);
  for (const student of simulated) {
    assert.ok(existsSync(`public${studentPhoto(student)}`));
    assert.ok(existsSync(`public${studentPhoto({ ...student, photoUrl: undefined })}`));
    assert.equal(studentName(student), `${student.lastName} ${student.firstName}`);
  }
});

test("every seeded child resolves to the same stable bundled portrait on every surface", () => {
  const students = createSeedSnapshot().students;
  for (const student of students) {
    const first = studentPhoto(student);
    const second = studentPhoto(structuredClone(student));
    assert.equal(first, second);
    assert.match(first, /^\/students\//);
    assert.ok(existsSync(`public${first}`), `${student.id} apunta a una foto inexistente: ${first}`);
  }
});

function setup() {
  const seed = withDemoFamilyPlans(createSeedSnapshot());
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

test("late replacement publishes once, removes the pickup and invalidates its pass", () => {
  const { store, trip, input } = setup();
  let notifications = 0;
  store.subscribe((snapshot) => {
    notifications++;
    assert.equal(snapshot.trips.some((item) => item.id === trip.id), false);
    assert.equal(snapshot.latePickups.filter((item) => item.guardianId === input.guardianId).length, 1);
  });
  const snapshot = store.createLatePickup(input);
  assert.equal(notifications, 1);
  assert.equal(store.historyRows().some((row) => row.tripId === trip.id), false);
  assert.equal(snapshot.requests.some((request) => request.tripId === trip.id), false);
  assert.equal(snapshot.events.some((event) => event.tripId === trip.id), false);
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
  assert.equal(store.historyRows().some((row) => row.tripId === trip.id), false);
  assert.equal(snapshot.requests.some((request) => request.tripId === trip.id), false);
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
