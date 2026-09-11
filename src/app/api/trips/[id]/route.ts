import { pushFriendPickupRequested } from "@/lib/friend-push";
import { mutateStore } from "@/lib/store";
import type { UpdateTripInput } from "@/lib/types";

export async function POST(request: Request, context: RouteContext<"/api/trips/[id]">) {
  try {
    const body = (await request.json()) as UpdateTripInput;
    const { id } = await context.params;
    const snapshot = await mutateStore((store) => store.updateTrip(id, body));
    await pushFriendPickupRequested(snapshot, id);
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el plan de hoy.";
    return Response.json({ error: message }, { status: 400 });
  }
}
