import { pushFriendPickupRequested } from "@/lib/friend-push";
import { mutateStore, readSnapshot } from "@/lib/store";
import type { CreateTripInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateTripInput;
    const before = await readSnapshot();
    const known = new Set(before.trips.map((trip) => trip.id));
    const snapshot = await mutateStore((store) => store.createTrip(body));
    const trip = snapshot.trips.find((item) => !known.has(item.id));
    if (trip) await pushFriendPickupRequested(snapshot, trip.id);
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
    return Response.json({ error: message }, { status: 400 });
  }
}
