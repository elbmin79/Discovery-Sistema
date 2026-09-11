import type { APIRequestContext } from "@playwright/test";
import type { Snapshot } from "../../src/lib/types";

async function createPlan(
  request: APIRequestContext,
  data: {
    guardianId: string;
    studentIds: string[];
    pickerName: string;
    pickerRelationEs: string;
    pickerRelationEn: string;
    vehicleId: string;
  },
) {
  const response = await request.post("/api/trips", {
    data: {
      ...data,
      pickerKind: "self",
      method: "car",
    },
  });
  if (!response.ok()) {
    throw new Error(`No se pudo crear el plan: ${response.status()} ${await response.text()}`);
  }
  const snapshot = (await response.json()) as Snapshot;
  const trip = snapshot.trips.find((item) => item.guardianId === data.guardianId && !item.cancelledAt);
  if (!trip) throw new Error("No apareció el trip.");
  return trip;
}

/** Plan demo de Madrid tras Nueva jornada (el seed ya no lo trae). */
export function createMadridPlan(request: APIRequestContext) {
  return createPlan(request, {
    guardianId: "g-roberto",
    studentIds: ["s-sofia", "s-lucas"],
    pickerName: "Madrid Roberto",
    pickerRelationEs: "Papá",
    pickerRelationEn: "Dad",
    vehicleId: "v-prius",
  });
}

export function createMarquezPlan(request: APIRequestContext) {
  return createPlan(request, {
    guardianId: "g-benjamin",
    studentIds: ["s-emiliano", "s-isabela", "s-paula"],
    pickerName: "Márquez Benjamín",
    pickerRelationEs: "Papá",
    pickerRelationEn: "Dad",
    vehicleId: "v-kicks",
  });
}
