import { mutateStore } from "@/lib/store";
import { storeArrivalPhoto } from "@/lib/arrival-photos";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tagId?: string; photo?: string; createIfMissing?: boolean };
    if (!body.tagId) {
      return Response.json({ error: "Falta el tag del vehículo." }, { status: 400 });
    }
    return Response.json(
      await mutateStore(async (store) => {
        const snapshot = store.arriveByTag(body.tagId!, { createIfMissing: body.createIfMissing });
        const { trip } = store.activeTripForTag(body.tagId!.trim());
        const photo = trip && await storeArrivalPhoto(body.photo, trip.id, trip.arrivedAt!);
        return photo && trip ? store.setArrivalPhoto(trip.id, photo) : snapshot;
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la llegada.";
    return Response.json({ error: message }, { status: 400 });
  }
}
