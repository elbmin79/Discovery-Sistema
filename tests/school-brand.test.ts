import assert from "node:assert/strict";
import { test } from "node:test";
import { brandedAccent, SCHOOL_BRANDS } from "../src/lib/school-brand";
import { SCHOOL } from "../src/lib/school";
import { MemoryPickupStore } from "../src/lib/store/memory-store";

test("switching school brand updates the name and survives a new jornada", () => {
  const store = new MemoryPickupStore();
  assert.equal(store.snapshot().school.brand ?? "discovery", "discovery");
  assert.equal(store.snapshot().school.name, SCHOOL.name);

  store.setSchoolBrand("altius");
  assert.equal(store.snapshot().school.brand, "altius");
  assert.equal(store.snapshot().school.name, SCHOOL_BRANDS.altius.name);

  store.reset();
  assert.equal(store.snapshot().school.brand, "altius");
  assert.equal(store.snapshot().school.name, SCHOOL_BRANDS.altius.name);

  store.setSchoolBrand("discovery");
  assert.equal(store.snapshot().school.brand, "discovery");
  assert.equal(store.snapshot().school.name, SCHOOL.name);
  assert.throws(() => store.setSchoolBrand("otro"));
});

test("green student accents remap to blue for Altius", () => {
  assert.equal(brandedAccent("#1B4D3E", "discovery"), "#1B4D3E");
  assert.equal(brandedAccent("#1B4D3E", "altius"), "#1C3D73");
  assert.equal(brandedAccent("#C4A15A", "altius"), "#C4A15A");
});
