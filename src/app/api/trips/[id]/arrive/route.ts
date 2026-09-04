import { mutateStore, readSnapshot } from "@/lib/store";
import { storeArrivalPhoto } from "@/lib/arrival-photos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { photo?: string; code?: string };
    const snapshot = await readSnapshot();
    const trip = snapshot.trips.find((item) => item.id === id || item.code === (body.code ?? id));
    if (!trip) {
      return Response.json({ error: "No encontramos esa llegada." }, { status: 404 });
    }
    return Response.json(
      await mutateStore(async (store) => {
        const arrived = store.arriveByCode(trip.code);
        const current = arrived.trips.find((item) => item.id === trip.id)!;
        const photo = await storeArrivalPhoto(body.photo, current.id, current.arrivedAt!);
        return photo ? store.setArrivalPhoto(current.id, photo) : arrived;
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
