import { mutateStore } from "@/lib/store";
import type { UpdateTripInput } from "@/lib/types";

export async function POST(request: Request, context: RouteContext<"/api/trips/[id]">) {
  try {
    const body = (await request.json()) as UpdateTripInput;
    const { id } = await context.params;
    return Response.json(await mutateStore((store) => store.updateTrip(id, body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el plan de hoy.";
    return Response.json({ error: message }, { status: 400 });
  }
}
