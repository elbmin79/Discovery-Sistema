import { getStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { photo?: string; code?: string };
    const store = getStore();
    const snapshot = store.snapshot();
    const trip = snapshot.trips.find((item) => item.id === id || item.code === (body.code ?? id));
    if (!trip) {
      return Response.json({ error: "No encontramos esa llegada." }, { status: 404 });
    }
    return Response.json(store.arriveByCode(trip.code, { photo: body.photo }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
