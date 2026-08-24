import { mutateStore } from "@/lib/store";
import type { CreateTripInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateTripInput;
    const snapshot = await mutateStore((store) => store.createTrip(body));
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
    return Response.json({ error: message }, { status: 400 });
  }
}
